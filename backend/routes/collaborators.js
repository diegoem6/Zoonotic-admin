const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all collaborators
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM collaborators ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single collaborator with projects and hours
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collabResult = await db.query('SELECT * FROM collaborators WHERE id=$1', [id]);
    if (collabResult.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });

    // Projects assigned
    const projectsResult = await db.query(`
      SELECT p.id, p.name, p.status, p.type, p.billing_date, p.razon_social,
        c.name as client_name,
        COALESCE(SUM(ph.hours), 0) as total_hours_executed
      FROM project_owners po
      JOIN projects p ON p.id = po.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_hours ph ON ph.project_id = p.id AND ph.collaborator_id = $1
      WHERE po.owner_type = 'Colaborador' AND po.collaborator_id = $1
      GROUP BY p.id, p.name, p.status, p.type, p.billing_date, p.razon_social, c.name
      ORDER BY p.created_at DESC
    `, [id]);

    res.json({ ...collabResult.rows[0], projects: projectsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create collaborator
router.post('/', async (req, res) => {
  try {
    const { name, start_date, email, condition } = req.body;
    const result = await db.query(
      'INSERT INTO collaborators (name, start_date, email, condition) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, start_date || null, email, condition]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update collaborator
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_date, email, condition, active } = req.body;
    const result = await db.query(
      'UPDATE collaborators SET name=$1, start_date=$2, email=$3, condition=$4, active=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, start_date || null, email, condition, active !== undefined ? active : true, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE collaborator
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM collaborators WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
