const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config for receipt uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../uploads/receipts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// GET all expenses
router.get('/', async (req, res) => {
  try {
    const { collaborator_id, from, to, currency, payment_status } = req.query;
    let query = `
      SELECT e.*, col.name as collaborator_name, p.name as project_name
      FROM expenses e
      LEFT JOIN collaborators col ON col.id = e.collaborator_id
      LEFT JOIN projects p ON p.id = e.project_id
    `;
    const conditions = [];
    const params = [];
    if (collaborator_id) { params.push(collaborator_id); conditions.push(`e.collaborator_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`e.date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`e.date <= $${params.length}`); }
    if (currency) { params.push(currency); conditions.push(`e.currency = $${params.length}`); }
    if (payment_status) { params.push(payment_status); conditions.push(`e.payment_status = $${params.length}`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY e.date DESC, e.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create expense
router.post('/', async (req, res) => {
  try {
    const { date, description, amount, currency, collaborator_id, comment, type, payment_status } = req.body;
    const result = await db.query(`
      INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, type, payment_status, auto_generated)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE) RETURNING *
    `, [date, description, amount, currency, collaborator_id || null, comment, type || 'Egreso', payment_status || 'pendiente']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update expense (all expenses including auto-generated)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, description, amount, currency, collaborator_id, comment, type, payment_status } = req.body;
    const result = await db.query(`
      UPDATE expenses SET date=$1, description=$2, amount=$3, currency=$4,
        collaborator_id=$5, comment=$6, type=$7, payment_status=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [date, description, amount, currency, collaborator_id || null, comment, type || 'Egreso', payment_status || 'pendiente', id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/status — toggle payment_status quickly
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;
    if (!['pendiente', 'pagado'].includes(payment_status)) {
      return res.status(400).json({ error: 'Estado inválido. Use pendiente o pagado.' });
    }
    const result = await db.query(
      'UPDATE expenses SET payment_status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [payment_status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/receipt — upload payment receipt file
router.post('/:id/receipt', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/receipts/${req.file.filename}`;
    const result = await db.query(
      'UPDATE expenses SET receipt_file=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [filePath, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json({ receipt_file: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE expense (only non-auto-generated)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT auto_generated FROM expenses WHERE id=$1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].auto_generated) return res.status(400).json({ error: 'Cannot delete auto-generated expense. Delete from project instead.' });
    await db.query('DELETE FROM expenses WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET summary by collaborator (only pagado)
router.get('/summary/collaborator', async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        col.id, col.name as collaborator_name,
        SUM(CASE WHEN e.currency='USD' AND e.type='Egreso'     THEN e.amount ELSE 0 END) as total_egreso_usd,
        SUM(CASE WHEN e.currency='UYU' AND e.type='Egreso'     THEN e.amount ELSE 0 END) as total_egreso_uyu,
        SUM(CASE WHEN e.currency='USD' AND e.type='Devolución' THEN e.amount ELSE 0 END) as total_devolucion_usd,
        SUM(CASE WHEN e.currency='UYU' AND e.type='Devolución' THEN e.amount ELSE 0 END) as total_devolucion_uyu
      FROM expenses e
      JOIN collaborators col ON col.id = e.collaborator_id
      WHERE e.payment_status = 'pagado'
      GROUP BY col.id, col.name
      ORDER BY col.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
