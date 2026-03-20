const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all clients
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, 
        json_agg(json_build_object('id', cr.id, 'name', cr.name, 'email', cr.email, 'phone', cr.phone) 
          ORDER BY cr.id) FILTER (WHERE cr.id IS NOT NULL) as referentes
      FROM clients c
      LEFT JOIN client_referentes cr ON cr.client_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single client
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT c.*, 
        json_agg(json_build_object('id', cr.id, 'name', cr.name, 'email', cr.email, 'phone', cr.phone)
          ORDER BY cr.id) FILTER (WHERE cr.id IS NOT NULL) as referentes
      FROM clients c
      LEFT JOIN client_referentes cr ON cr.client_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create client
router.post('/', async (req, res) => {
  const client = await db.connect();
  try {
    const { name, rut, description, referentes = [] } = req.body;
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO clients (name, rut, description) VALUES ($1, $2, $3) RETURNING *',
      [name, rut, description]
    );
    const newClient = result.rows[0];
    for (const ref of referentes) {
      await client.query(
        'INSERT INTO client_referentes (client_id, name, email, phone) VALUES ($1, $2, $3, $4)',
        [newClient.id, ref.name, ref.email, ref.phone]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(newClient);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  const conn = await db.connect();
  try {
    const { id } = req.params;
    const { name, rut, description, referentes = [] } = req.body;
    await conn.query('BEGIN');
    const result = await conn.query(
      'UPDATE clients SET name=$1, rut=$2, description=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [name, rut, description, id]
    );
    if (result.rows.length === 0) { await conn.query('ROLLBACK'); return res.status(404).json({ error: 'Client not found' }); }
    // Replace referentes
    await conn.query('DELETE FROM client_referentes WHERE client_id=$1', [id]);
    for (const ref of referentes) {
      await conn.query(
        'INSERT INTO client_referentes (client_id, name, email, phone) VALUES ($1, $2, $3, $4)',
        [id, ref.name, ref.email, ref.phone]
      );
    }
    await conn.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM clients WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
