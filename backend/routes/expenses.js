const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all expenses
router.get('/', async (req, res) => {
  try {
    const { collaborator_id, from, to, currency } = req.query;
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
    const { date, description, amount, currency, collaborator_id, comment, type } = req.body;
    const result = await db.query(`
      INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, type, auto_generated)
      VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE) RETURNING *
    `, [date, description, amount, currency, collaborator_id || null, comment, type || 'Egreso']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update expense
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, description, amount, currency, collaborator_id, comment, type } = req.body;
    const result = await db.query(`
      UPDATE expenses SET date=$1, description=$2, amount=$3, currency=$4,
        collaborator_id=$5, comment=$6, type=$7, updated_at=NOW()
      WHERE id=$8 AND auto_generated=FALSE RETURNING *
    `, [date, description, amount, currency, collaborator_id || null, comment, type || 'Egreso', id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found or auto-generated' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE expense
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Check if auto-generated
    const check = await db.query('SELECT auto_generated FROM expenses WHERE id=$1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].auto_generated) return res.status(400).json({ error: 'Cannot delete auto-generated expense. Delete from project instead.' });
    await db.query('DELETE FROM expenses WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET summary by collaborator
router.get('/summary/collaborator', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        col.id, col.name as collaborator_name,
        SUM(CASE WHEN e.currency='USD' AND e.type='Egreso' THEN e.amount ELSE 0 END) as total_egreso_usd,
        SUM(CASE WHEN e.currency='UYU' AND e.type='Egreso' THEN e.amount ELSE 0 END) as total_egreso_uyu,
        SUM(CASE WHEN e.currency='USD' AND e.type='Devolución' THEN e.amount ELSE 0 END) as total_devolucion_usd,
        SUM(CASE WHEN e.currency='UYU' AND e.type='Devolución' THEN e.amount ELSE 0 END) as total_devolucion_uyu
      FROM expenses e
      JOIN collaborators col ON col.id = e.collaborator_id
      GROUP BY col.id, col.name
      ORDER BY col.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
