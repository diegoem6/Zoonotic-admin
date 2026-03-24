const express = require('express');
const router  = express.Router();
const db      = require('../db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../uploads/payment-receipts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// GET / — lista todos los pagos
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.*,
        col.name                          AS collaborator_name,
        COUNT(pei.id)::int                AS item_count,
        COALESCE(SUM(pei.amount), 0)      AS total_allocated
      FROM payments p
      LEFT JOIN collaborators col         ON col.id = p.collaborator_id
      LEFT JOIN payment_expense_items pei ON pei.payment_id = p.id
      GROUP BY p.id, col.name
      ORDER BY p.date DESC, p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /pending-expenses — egresos pendientes para un colaborador/moneda (modo creación)
// Incluye already_allocated: suma de otros pagos ya asignados al egreso
router.get('/pending-expenses', async (req, res) => {
  try {
    const { collaborator_id, currency } = req.query;
    if (!collaborator_id || !currency) {
      return res.status(400).json({ error: 'Se requiere collaborator_id y currency' });
    }
    const result = await db.query(`
      SELECT
        e.*,
        COALESCE(SUM(pei.amount), 0) AS already_allocated
      FROM expenses e
      LEFT JOIN payment_expense_items pei ON pei.expense_id = e.id
      WHERE e.payment_status  = 'pendiente'
        AND e.type            = 'Egreso'
        AND e.collaborator_id = $1
        AND e.currency        = $2
      GROUP BY e.id
      ORDER BY e.date ASC
    `, [collaborator_id, currency]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/expenses-for-edit — egresos para editar un pago existente:
// incluye los ya asignados a este pago (aunque estén pagados) + los pendientes del mismo colaborador/moneda
router.get('/:id/expenses-for-edit', async (req, res) => {
  try {
    const payRes = await db.query(
      'SELECT collaborator_id, currency FROM payments WHERE id = $1',
      [req.params.id]
    );
    if (payRes.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    const { collaborator_id, currency } = payRes.rows[0];

    const result = await db.query(`
      SELECT
        e.*,
        COALESCE(SUM(pei.amount), 0) AS already_allocated,
        COALESCE(
          (SELECT pei2.amount FROM payment_expense_items pei2
           WHERE pei2.payment_id = $1 AND pei2.expense_id = e.id),
          0
        ) AS this_payment_allocation
      FROM expenses e
      LEFT JOIN payment_expense_items pei ON pei.expense_id = e.id
      WHERE e.collaborator_id = $2
        AND e.currency        = $3
        AND e.type            = 'Egreso'
        AND (
          e.payment_status = 'pendiente'
          OR EXISTS (
            SELECT 1 FROM payment_expense_items
            WHERE payment_id = $1 AND expense_id = e.id
          )
        )
      GROUP BY e.id
      ORDER BY e.date ASC
    `, [req.params.id, collaborator_id, currency]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — detalle de un pago con sus items
router.get('/:id', async (req, res) => {
  try {
    const [payRes, itemsRes] = await Promise.all([
      db.query(`
        SELECT p.*, col.name AS collaborator_name
        FROM payments p
        LEFT JOIN collaborators col ON col.id = p.collaborator_id
        WHERE p.id = $1
      `, [req.params.id]),
      db.query(`
        SELECT pei.*, e.description, e.amount AS expense_amount,
               e.date AS expense_date, e.payment_status
        FROM payment_expense_items pei
        JOIN expenses e ON e.id = pei.expense_id
        WHERE pei.payment_id = $1
        ORDER BY e.date ASC
      `, [req.params.id]),
    ]);
    if (payRes.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ ...payRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — crear pago
router.post('/', async (req, res) => {
  const { date, amount, currency, collaborator_id, notes, items } = req.body;
  if (!date || !currency) {
    return res.status(400).json({ error: 'Fecha y moneda son obligatorios' });
  }
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');

    const payRes = await conn.query(
      `INSERT INTO payments (date, amount, currency, collaborator_id, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [date, amount || 0, currency, collaborator_id || null, notes || null]
    );
    const payment = payRes.rows[0];

    for (const item of (items || [])) {
      const itemAmount = parseFloat(item.amount);
      if (!item.expense_id || !(itemAmount > 0)) continue;

      await conn.query(
        `INSERT INTO payment_expense_items (payment_id, expense_id, amount) VALUES ($1, $2, $3)`,
        [payment.id, item.expense_id, itemAmount]
      );
      await _reevaluateExpense(conn, item.expense_id);
    }

    await conn.query('COMMIT');
    res.status(201).json(payment);
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /:id — editar pago: reemplaza items y re-evalúa egresos afectados
router.put('/:id', async (req, res) => {
  const { date, amount, currency, collaborator_id, notes, items } = req.body;
  if (!date || !currency) {
    return res.status(400).json({ error: 'Fecha y moneda son obligatorios' });
  }
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');

    // Egresos que estaban en el pago antes de editar
    const oldItems = await conn.query(
      'SELECT DISTINCT expense_id FROM payment_expense_items WHERE payment_id = $1',
      [req.params.id]
    );
    const oldExpenseIds = oldItems.rows.map(r => r.expense_id);

    // Borrar items anteriores
    await conn.query('DELETE FROM payment_expense_items WHERE payment_id = $1', [req.params.id]);

    // Actualizar cabecera del pago
    const payRes = await conn.query(
      `UPDATE payments
       SET date=$1, amount=$2, currency=$3, collaborator_id=$4, notes=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [date, amount || 0, currency, collaborator_id || null, notes || null, req.params.id]
    );
    if (payRes.rows.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    // Insertar nuevos items
    const newExpenseIds = [];
    for (const item of (items || [])) {
      const itemAmount = parseFloat(item.amount);
      if (!item.expense_id || !(itemAmount > 0)) continue;
      await conn.query(
        `INSERT INTO payment_expense_items (payment_id, expense_id, amount) VALUES ($1, $2, $3)`,
        [req.params.id, item.expense_id, itemAmount]
      );
      newExpenseIds.push(item.expense_id);
    }

    // Re-evaluar todos los egresos afectados (anteriores + nuevos)
    const allIds = [...new Set([...oldExpenseIds, ...newExpenseIds])];
    for (const expense_id of allIds) {
      await _reevaluateExpense(conn, expense_id);
    }

    await conn.query('COMMIT');
    res.json(payRes.rows[0]);
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /:id/receipt — subir comprobante de pago
router.post('/:id/receipt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const filePath = `/uploads/payment-receipts/${req.file.filename}`;
    const result = await db.query(
      'UPDATE payments SET receipt_file=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [filePath, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ receipt_file: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — eliminar pago y revertir egresos que queden sin cubrir
router.delete('/:id', async (req, res) => {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');

    const itemsRes = await conn.query(
      'SELECT DISTINCT expense_id FROM payment_expense_items WHERE payment_id = $1',
      [req.params.id]
    );
    const affectedIds = itemsRes.rows.map(r => r.expense_id);

    await conn.query('DELETE FROM payments WHERE id = $1', [req.params.id]);

    for (const expense_id of affectedIds) {
      await _reevaluateExpense(conn, expense_id);
    }

    await conn.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Helper: recalcula el estado de un egreso y gestiona los egresos parciales hijos.
//
// Lógica:
//  - Si el total asignado cubre el 100% → borra los parciales, marca el padre como 'pagado'.
//  - Si cubre parcialmente → mantiene el padre como 'pendiente',
//    borra y recrea un egreso-hijo 'pagado' por cada asignación vigente
//    (con la fecha del pago y el monto asignado). Esos hijos aparecen en el flujo.
//  - Si no hay asignaciones → limpia parciales, mantiene pendiente.
async function _reevaluateExpense(conn, expense_id) {
  // Sólo procesar egresos que NO son parciales ellos mismos
  const expRes = await conn.query(
    `SELECT id, amount, description, currency, collaborator_id
     FROM expenses WHERE id = $1 AND COALESCE(is_partial, FALSE) = FALSE`,
    [expense_id]
  );
  if (expRes.rows.length === 0) return;
  const expense = expRes.rows[0];

  // Todas las asignaciones vigentes para este egreso
  const allocRes = await conn.query(
    `SELECT pei.amount, p.date AS payment_date, p.id AS payment_id
     FROM payment_expense_items pei
     JOIN payments p ON p.id = pei.payment_id
     WHERE pei.expense_id = $1
     ORDER BY p.date ASC`,
    [expense_id]
  );

  const totalAllocated = allocRes.rows.reduce((s, r) => s + parseFloat(r.amount), 0);

  // Borrar siempre los parciales anteriores para reconstruir desde cero
  await conn.query(
    `DELETE FROM expenses WHERE parent_expense_id = $1 AND is_partial = TRUE`,
    [expense_id]
  );

  if (totalAllocated >= parseFloat(expense.amount)) {
    // Pago completo: el padre pasa a 'pagado' con la fecha del último pago
    const latestDate = allocRes.rows.at(-1)?.payment_date ?? new Date().toISOString().split('T')[0];
    await conn.query(
      `UPDATE expenses SET payment_status = 'pagado', paid_at = $1, updated_at = NOW() WHERE id = $2`,
      [latestDate, expense_id]
    );
  } else if (allocRes.rows.length > 0) {
    // Pago parcial: padre sigue pendiente, se generan hijos por cada pago
    await conn.query(
      `UPDATE expenses SET payment_status = 'pendiente', paid_at = NULL, updated_at = NOW() WHERE id = $1`,
      [expense_id]
    );
    for (const alloc of allocRes.rows) {
      await conn.query(
        `INSERT INTO expenses
           (date, description, amount, currency, collaborator_id,
            type, payment_status, paid_at,
            is_partial, parent_expense_id, source_payment_id, auto_generated)
         VALUES ($1, $2, $3, $4, $5,
                 'Egreso', 'pagado', $1,
                 TRUE, $6, $7, TRUE)`,
        [alloc.payment_date, expense.description, alloc.amount,
         expense.currency, expense.collaborator_id,
         expense_id, alloc.payment_id]
      );
    }
  } else {
    // Sin asignaciones: asegurar estado pendiente
    await conn.query(
      `UPDATE expenses SET payment_status = 'pendiente', paid_at = NULL, updated_at = NOW() WHERE id = $1`,
      [expense_id]
    );
  }
}

module.exports = router;
