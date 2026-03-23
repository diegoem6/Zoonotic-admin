const express = require('express');
const router = express.Router();
const db = require('../db');

// GET billing summary by month
router.get('/summary', async (req, res) => {
  try {
    const { year, razon_social } = req.query;
    let conditions = ["status IN ('Facturado', 'Cobrado')", "billing_date IS NOT NULL"];
    const params = [];
    if (year) { params.push(year); conditions.push(`EXTRACT(YEAR FROM billing_date) = $${params.length}`); }
    if (razon_social) { params.push(razon_social); conditions.push(`razon_social = $${params.length}`); }
    const where = 'WHERE ' + conditions.join(' AND ');

    const result = await db.query(`
      SELECT 
        razon_social,
        EXTRACT(YEAR FROM billing_date)::int as year,
        EXTRACT(MONTH FROM billing_date)::int as month,
        COUNT(*) as project_count,
        COALESCE(SUM(subtotal_usd), 0) as subtotal_usd,
        COALESCE(SUM(iva_usd), 0) as iva_usd,
        COALESCE(SUM(total_usd), 0) as total_usd,
        COALESCE(SUM(subtotal_uyu), 0) as subtotal_uyu,
        COALESCE(SUM(iva_uyu), 0) as iva_uyu,
        COALESCE(SUM(total_uyu), 0) as total_uyu
      FROM projects
      ${where}
      GROUP BY razon_social, EXTRACT(YEAR FROM billing_date), EXTRACT(MONTH FROM billing_date)
      ORDER BY year DESC, month DESC, razon_social
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET billing summary grouped by status (for chart breakdown)
router.get('/summary/by-status', async (req, res) => {
  try {
    const { year } = req.query;
    const params = [];
    const conditions = ["status IN ('Facturado', 'Cobrado')", "billing_date IS NOT NULL"];
    if (year) { params.push(year); conditions.push(`EXTRACT(YEAR FROM billing_date) = $${params.length}`); }
    const where = 'WHERE ' + conditions.join(' AND ');

    const result = await db.query(`
      SELECT
        razon_social,
        status,
        EXTRACT(MONTH FROM billing_date)::int as month,
        COALESCE(SUM(subtotal_usd), 0) as subtotal_usd,
        COALESCE(SUM(subtotal_uyu), 0) as subtotal_uyu
      FROM projects
      ${where}
      GROUP BY razon_social, status, EXTRACT(MONTH FROM billing_date)
      ORDER BY month, razon_social, status
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET billing summary combined (both companies)
router.get('/summary/combined', async (req, res) => {
  try {
    const { year } = req.query;
    const params = year ? [year] : [];
    const yearCondition = year ? 'AND EXTRACT(YEAR FROM billing_date) = $1' : '';

    const result = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM billing_date)::int as year,
        EXTRACT(MONTH FROM billing_date)::int as month,
        COUNT(*) as project_count,
        COALESCE(SUM(subtotal_usd), 0) as subtotal_usd,
        COALESCE(SUM(iva_usd), 0) as iva_usd,
        COALESCE(SUM(total_usd), 0) as total_usd,
        COALESCE(SUM(subtotal_uyu), 0) as subtotal_uyu,
        COALESCE(SUM(iva_uyu), 0) as iva_uyu,
        COALESCE(SUM(total_uyu), 0) as total_uyu
      FROM projects
      WHERE status IN ('Facturado', 'Cobrado') AND billing_date IS NOT NULL ${yearCondition}
      GROUP BY EXTRACT(YEAR FROM billing_date), EXTRACT(MONTH FROM billing_date)
      ORDER BY year DESC, month DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
