const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/quotes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDFs allowed'));
}});

// GET all projects
router.get('/', async (req, res) => {
  try {
    const { status, razon_social, client_id } = req.query;
    let query = `
      SELECT p.*,
        c.name as client_name,
        json_agg(DISTINCT jsonb_build_object(
          'id', po.id,
          'owner_type', po.owner_type,
          'collaborator_id', po.collaborator_id,
          'collaborator_name', col.name,
          'collaborator_condition', col.condition
        )) FILTER (WHERE po.id IS NOT NULL) as owners
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_owners po ON po.project_id = p.id
      LEFT JOIN collaborators col ON col.id = po.collaborator_id
    `;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (razon_social) { params.push(razon_social); conditions.push(`p.razon_social = $${params.length}`); }
    if (client_id) { params.push(client_id); conditions.push(`p.client_id = $${params.length}`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY p.id, c.name ORDER BY p.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single project
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT p.*,
        c.name as client_name,
        json_agg(DISTINCT jsonb_build_object(
          'id', po.id, 'owner_type', po.owner_type,
          'collaborator_id', po.collaborator_id,
          'collaborator_name', col.name,
          'collaborator_condition', col.condition
        )) FILTER (WHERE po.id IS NOT NULL) as owners
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_owners po ON po.project_id = p.id
      LEFT JOIN collaborators col ON col.id = po.collaborator_id
      WHERE p.id = $1
      GROUP BY p.id, c.name
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', async (req, res) => {
  const conn = await db.connect();
  try {
    const {
      name, status, client_id, requestor, po, type, hours_estimated,
      iva_rate,
      billing_date, razon_social, invoice_number, currency,
      subtotal_usd, iva_usd, total_usd, subtotal_uyu, iva_uyu, total_uyu,
      possible_payment_date, actual_payment_date, comments, owners = []
    } = req.body;

    await conn.query('BEGIN');

    const result = await conn.query(`
      INSERT INTO projects (name, status, client_id, requestor, po, type, hours_estimated,
        iva_rate, billing_date, razon_social, invoice_number, currency,
        subtotal_usd, iva_usd, total_usd, subtotal_uyu, iva_uyu, total_uyu,
        possible_payment_date, actual_payment_date, comments)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [name, status || 'Falta Cotizar', client_id || null, requestor, po, type, hours_estimated || null,
        iva_rate !== undefined ? iva_rate : 0.22,
        billing_date || null, razon_social, invoice_number,
        currency, subtotal_usd || 0, iva_usd || 0, total_usd || 0,
        subtotal_uyu || 0, iva_uyu || 0, total_uyu || 0,
        possible_payment_date || null, actual_payment_date || null, comments || null]);

    const project = result.rows[0];

    // Insert owners
    for (const owner of owners) {
      await conn.query(
        'INSERT INTO project_owners (project_id, owner_type, collaborator_id) VALUES ($1,$2,$3)',
        [project.id, owner.owner_type, owner.collaborator_id || null]
      );
    }

    // Auto-generate collaborator expenses if created directly as Cobrado
    if (status === 'Cobrado') {
      await autoGenerateExpensesOnCobrado(conn, project);
    }

    await conn.query('COMMIT');
    res.status(201).json(project);
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT update project
router.put('/:id', async (req, res) => {
  const conn = await db.connect();
  try {
    const { id } = req.params;
    const {
      name, status, client_id, requestor, po, type, hours_estimated,
      iva_rate,
      billing_date, razon_social, invoice_number, currency,
      subtotal_usd, iva_usd, total_usd, subtotal_uyu, iva_uyu, total_uyu,
      possible_payment_date, actual_payment_date, comments, owners = []
    } = req.body;

    await conn.query('BEGIN');

    // Get previous state to check for billing transition
    const prevResult = await conn.query('SELECT * FROM projects WHERE id=$1', [id]);
    if (prevResult.rows.length === 0) { await conn.query('ROLLBACK'); return res.status(404).json({ error: 'Project not found' }); }
    const prevProject = prevResult.rows[0];

    const result = await conn.query(`
      UPDATE projects SET name=$1, status=$2, client_id=$3, requestor=$4, po=$5, type=$6,
        hours_estimated=$7, iva_rate=$8, billing_date=$9, razon_social=$10, invoice_number=$11, currency=$12,
        subtotal_usd=$13, iva_usd=$14, total_usd=$15, subtotal_uyu=$16, iva_uyu=$17, total_uyu=$18,
        possible_payment_date=$19, actual_payment_date=$20, comments=$21, updated_at=NOW()
      WHERE id=$22 RETURNING *
    `, [name, status, client_id || null, requestor, po, type, hours_estimated || null,
        iva_rate !== undefined ? iva_rate : 0.22,
        billing_date || null, razon_social, invoice_number, currency,
        subtotal_usd || 0, iva_usd || 0, total_usd || 0,
        subtotal_uyu || 0, iva_uyu || 0, total_uyu || 0,
        possible_payment_date || null, actual_payment_date || null, comments || null, id]);

    const project = result.rows[0];

    // Replace owners
    await conn.query('DELETE FROM project_owners WHERE project_id=$1', [id]);
    for (const owner of owners) {
      await conn.query(
        'INSERT INTO project_owners (project_id, owner_type, collaborator_id) VALUES ($1,$2,$3)',
        [id, owner.owner_type, owner.collaborator_id || null]
      );
    }

    // Auto-generate collaborator expenses when transitioning to Cobrado
    if (status === 'Cobrado' && prevProject.status !== 'Cobrado') {
      await autoGenerateExpensesOnCobrado(conn, project);
    }

    await conn.query('COMMIT');
    res.json(project);
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM expenses WHERE project_id=$1 AND auto_generated=TRUE', [id]);
    await db.query('DELETE FROM projects WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload quote PDF
router.post('/:id/quote', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/quotes/${req.file.filename}`;
    await db.query('UPDATE projects SET quote_file=$1, updated_at=NOW() WHERE id=$2', [filePath, id]);
    res.json({ quote_file: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET project hours
router.get('/:id/hours', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT ph.*, col.name as collaborator_name
      FROM project_hours ph
      JOIN collaborators col ON col.id = ph.collaborator_id
      WHERE ph.project_id = $1
      ORDER BY ph.date DESC, ph.created_at DESC
    `, [id]);
    const totalResult = await db.query(`
      SELECT
        ph.collaborator_id,
        col.name as collaborator_name,
        SUM(ph.hours) as total_hours,
        SUM(CASE WHEN ph.hourly_rate IS NOT NULL THEN ph.hours * ph.hourly_rate ELSE 0 END) as total_cost_usd,
        SUM(CASE WHEN ph.hourly_rate IS NOT NULL AND ph.currency = 'UYU' THEN ph.hours * ph.hourly_rate ELSE 0 END) as total_cost_uyu
      FROM project_hours ph
      JOIN collaborators col ON col.id = ph.collaborator_id
      WHERE ph.project_id = $1
      GROUP BY ph.collaborator_id, col.name
    `, [id]);
    res.json({ entries: result.rows, totals: totalResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add hours to project
router.post('/:id/hours', async (req, res) => {
  try {
    const { id } = req.params;
    const { collaborator_id, hours, date, description, hourly_rate, currency } = req.body;
    const result = await db.query(
      'INSERT INTO project_hours (project_id, collaborator_id, hours, date, description, hourly_rate, currency) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, collaborator_id, hours, date || null, description, hourly_rate || null, currency || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE hours entry
router.delete('/:id/hours/:hourId', async (req, res) => {
  try {
    const { id, hourId } = req.params;
    await db.query('DELETE FROM project_hours WHERE id=$1 AND project_id=$2', [hourId, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET project viaticos
router.get('/:id/viaticos', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT pv.*, col.name as collaborator_name
      FROM project_viaticos pv
      JOIN collaborators col ON col.id = pv.collaborator_id
      WHERE pv.project_id = $1
      ORDER BY pv.date DESC, pv.created_at DESC
    `, [id]);
    const totalResult = await db.query(`
      SELECT
        pv.collaborator_id,
        col.name as collaborator_name,
        SUM(pv.dias) as total_dias,
        SUM(CASE WHEN pv.daily_rate IS NOT NULL AND (pv.currency IS NULL OR pv.currency != 'UYU') THEN pv.dias * pv.daily_rate ELSE 0 END) as total_cost_usd,
        SUM(CASE WHEN pv.daily_rate IS NOT NULL AND pv.currency = 'UYU' THEN pv.dias * pv.daily_rate ELSE 0 END) as total_cost_uyu
      FROM project_viaticos pv
      JOIN collaborators col ON col.id = pv.collaborator_id
      WHERE pv.project_id = $1
      GROUP BY pv.collaborator_id, col.name
    `, [id]);
    res.json({ entries: result.rows, totals: totalResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add viatico to project
router.post('/:id/viaticos', async (req, res) => {
  try {
    const { id } = req.params;
    const { collaborator_id, description, dias, date, daily_rate, currency } = req.body;
    if (!collaborator_id || !dias) return res.status(400).json({ error: 'Colaborador y días son obligatorios' });
    const result = await db.query(
      'INSERT INTO project_viaticos (project_id, collaborator_id, description, dias, date, daily_rate, currency) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, collaborator_id, description, dias, date || null, daily_rate || null, currency || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE viatico entry
router.delete('/:id/viaticos/:viaticId', async (req, res) => {
  try {
    const { id, viaticId } = req.params;
    await db.query('DELETE FROM project_viaticos WHERE id=$1 AND project_id=$2', [viaticId, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: auto-generate all collaborator expenses when a project transitions to "Cobrado"
async function autoGenerateExpensesOnCobrado(conn, project) {
  const projectId = project.id;
  const comment = 'Generado automáticamente al cobrar el proyecto';

  // Delete previous auto-generated expenses for this project before regenerating
  await conn.query('DELETE FROM expenses WHERE project_id=$1 AND auto_generated=TRUE', [projectId]);

  // Get all owners with collaborator condition
  const ownersResult = await conn.query(`
    SELECT po.collaborator_id, col.name as col_name, col.condition as col_condition
    FROM project_owners po
    JOIN collaborators col ON col.id = po.collaborator_id
    WHERE po.project_id = $1 AND po.collaborator_id IS NOT NULL
  `, [projectId]);
  const owners = ownersResult.rows;

  // 1. Contratado por horas — egresos por horas y viáticos, estado pendiente
  const hourCollabs = owners.filter(o => o.col_condition === 'Contratado por horas');
  for (const owner of hourCollabs) {
    // Horas: agrupado por moneda
    const hoursResult = await conn.query(`
      SELECT currency, SUM(hours * hourly_rate) as total
      FROM project_hours
      WHERE project_id = $1 AND collaborator_id = $2
        AND hourly_rate IS NOT NULL AND currency IS NOT NULL
      GROUP BY currency
    `, [projectId, owner.collaborator_id]);
    for (const row of hoursResult.rows) {
      if (parseFloat(row.total) > 0) {
        await conn.query(`
          INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, type, payment_status, auto_generated, project_id)
          VALUES (NOW(), $1, $2, $3, $4, $5, 'Egreso', 'pendiente', TRUE, $6)
        `, [`Horas proyecto: ${project.name}`, row.total, row.currency, owner.collaborator_id, comment, projectId]);
      }
    }

    // Viáticos: agrupado por moneda
    const viaticosResult = await conn.query(`
      SELECT currency, SUM(dias * daily_rate) as total
      FROM project_viaticos
      WHERE project_id = $1 AND collaborator_id = $2
        AND daily_rate IS NOT NULL AND currency IS NOT NULL
      GROUP BY currency
    `, [projectId, owner.collaborator_id]);
    for (const row of viaticosResult.rows) {
      if (parseFloat(row.total) > 0) {
        await conn.query(`
          INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, type, payment_status, auto_generated, project_id)
          VALUES (NOW(), $1, $2, $3, $4, $5, 'Egreso', 'pendiente', TRUE, $6)
        `, [`Viáticos proyecto: ${project.name}`, row.total, row.currency, owner.collaborator_id, comment, projectId]);
      }
    }
  }

  // 2. Coparticipante — 50% del 90% del subtotal en la moneda del proyecto, estado pendiente
  const copartCollabs = owners.filter(o => o.col_condition === 'Coparticipante');
  for (const owner of copartCollabs) {
    const currency = project.currency || 'USD';
    const subtotal = parseFloat(currency === 'USD' ? project.subtotal_usd : project.subtotal_uyu) || 0;
    const amount = subtotal * 0.9 * 0.5;
    if (amount > 0) {
      await conn.query(`
        INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, type, payment_status, auto_generated, project_id)
        VALUES (NOW(), $1, $2, $3, $4, $5, 'Egreso', 'pendiente', TRUE, $6)
      `, [
        `Coparticipación proyecto: ${project.name}`,
        amount, currency, owner.collaborator_id,
        `${comment} (45% del valor del proyecto)`, projectId
      ]);
    }
  }

  // 3. Ingeuy — 100% del subtotal para Diego Ricca (Socio), estado pagado
  if (project.razon_social === 'Ingeuy') {
    const diegoResult = await conn.query(
      "SELECT id FROM collaborators WHERE name ILIKE 'Diego Ricca' AND condition='Socio' LIMIT 1"
    );
    if (diegoResult.rows.length === 0) {
      console.warn('Diego Ricca (Socio) not found - skipping Ingeuy expense generation');
    } else {
      const currency = project.currency || 'USD';
      const amount = parseFloat(currency === 'USD' ? project.subtotal_usd : project.subtotal_uyu) || 0;
      if (amount > 0) {
        await conn.query(`
          INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, type, payment_status, auto_generated, project_id)
          VALUES ($1, $2, $3, $4, $5, $6, 'Egreso', 'pagado', TRUE, $7)
        `, [
          project.billing_date || new Date().toISOString().split('T')[0],
          `Pago proyecto Ingeuy: ${project.name}`,
          amount, currency, diegoResult.rows[0].id,
          'Generado automáticamente por facturación Ingeuy', projectId
        ]);
      }
    }
  }
}

module.exports = router;
