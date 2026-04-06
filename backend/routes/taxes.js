const express = require('express');
const router = express.Router();
const db = require('../db');

// GET taxes with optional filters
router.get('/', async (req, res) => {
  try {
    const { year, razon_social } = req.query;
    let query = 'SELECT * FROM taxes';
    const conditions = [];
    const params = [];
    if (year) { params.push(year); conditions.push(`year = $${params.length}`); }
    if (razon_social) { params.push(razon_social); conditions.push(`razon_social = $${params.length}`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY year DESC, month DESC, razon_social';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET calculated IVA for a month/year/razon_social
router.get('/iva-calc', async (req, res) => {
  try {
    const { month, year, razon_social } = req.query;
    if (!month || !year || !razon_social) return res.status(400).json({ error: 'month, year, razon_social required' });
    
    const result = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN currency = 'UYU' THEN iva_uyu ELSE 0 END), 0) as total_iva_uyu,
        COALESCE(SUM(CASE WHEN currency = 'USD' THEN iva_usd ELSE 0 END), 0) as total_iva_usd,
        COALESCE(SUM(CASE WHEN currency = 'UYU' THEN subtotal_uyu ELSE 0 END), 0) as total_subtotal_uyu,
        COALESCE(SUM(CASE WHEN currency = 'USD' THEN subtotal_usd ELSE 0 END), 0) as total_subtotal_usd
      FROM projects
      WHERE EXTRACT(MONTH FROM billing_date) = $1
        AND EXTRACT(YEAR FROM billing_date) = $2
        AND razon_social = $3
        AND billing_date IS NOT NULL
    `, [month, year, razon_social]);
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create or upsert tax record
router.post('/', async (req, res) => {
  try {
    const { month, year, razon_social, iva, iva_manual_override, irae, patrimonio, bps, notes } = req.body;
    const result = await db.query(`
      INSERT INTO taxes (month, year, razon_social, iva, iva_manual_override, irae, patrimonio, bps, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (month, year, razon_social) 
      DO UPDATE SET iva=$4, iva_manual_override=$5, irae=$6, patrimonio=$7, bps=$8, notes=$9, updated_at=NOW()
      RETURNING *
    `, [month, year, razon_social, iva || 0, iva_manual_override || false, irae || 0, patrimonio || 0, bps || 0, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update tax record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { iva, iva_manual_override, irae, patrimonio, bps, notes } = req.body;
    const result = await db.query(`
      UPDATE taxes SET iva=$1, iva_manual_override=$2, irae=$3, patrimonio=$4, bps=$5, notes=$6, updated_at=NOW()
      WHERE id=$7 RETURNING *
    `, [iva || 0, iva_manual_override || false, irae || 0, patrimonio || 0, bps || 0, notes, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM taxes WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET annual summary
router.get('/summary/annual', async (req, res) => {
  try {
    const { year } = req.query;
    const params = year ? [year] : [];
    const yearCondition = year ? 'WHERE t.year = $1' : '';
    const result = await db.query(`
      SELECT 
        t.year, t.month, t.razon_social,
        t.iva, t.irae, t.patrimonio, t.bps,
        (t.iva + t.irae + t.patrimonio + t.bps) as total
      FROM taxes t
      ${yearCondition}
      ORDER BY t.year DESC, t.month DESC, t.razon_social
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
