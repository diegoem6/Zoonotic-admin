const express = require('express');
const router = express.Router();
const db = require('../db');

// GET full cash flow - uses actual_payment_date (cobros), NOT billing_date
router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    const params = year ? [year] : [];
    const yc = year ? 'AND EXTRACT(YEAR FROM date) = $1' : '';
    const yp = year ? 'AND EXTRACT(YEAR FROM actual_payment_date) = $1' : '';
    const yt = year ? 'AND year = $1' : '';

    // COBROS: grouped by actual_payment_date (money actually received)
    const cobrosQuery = `
      SELECT
        EXTRACT(YEAR FROM actual_payment_date)::int  AS year,
        EXTRACT(MONTH FROM actual_payment_date)::int AS month,
        razon_social,
        COALESCE(SUM(subtotal_usd), 0) AS subtotal_usd,
        COALESCE(SUM(total_usd),    0) AS total_usd,
        COALESCE(SUM(subtotal_uyu), 0) AS subtotal_uyu,
        COALESCE(SUM(total_uyu),    0) AS total_uyu
      FROM projects
      WHERE actual_payment_date IS NOT NULL ${yp}
      GROUP BY year, month, razon_social
      ORDER BY year DESC, month DESC
    `;

    // EGRESOS DE SOCIOS by month and collaborator
    const sociosQuery = `
      SELECT
        EXTRACT(MONTH FROM e.date)::int AS month,
        col.id   AS collaborator_id,
        col.name AS collaborator_name,
        e.currency,
        COALESCE(SUM(CASE WHEN e.type = 'Egreso'     THEN e.amount ELSE 0 END), 0) AS total_egreso,
        COALESCE(SUM(CASE WHEN e.type = 'Devolución' THEN e.amount ELSE 0 END), 0) AS total_devolucion
      FROM expenses e
      JOIN collaborators col ON col.id = e.collaborator_id
      WHERE col.condition = 'Socio' ${yc}
      GROUP BY month, col.id, col.name, e.currency
      ORDER BY month, col.name
    `;

    // EGRESOS by month
    const expenseQuery = `
      SELECT
        EXTRACT(YEAR  FROM date)::int AS year,
        EXTRACT(MONTH FROM date)::int AS month,
        COALESCE(SUM(CASE WHEN currency='USD' AND type='Egreso'     THEN amount ELSE 0 END), 0) AS total_usd,
        COALESCE(SUM(CASE WHEN currency='UYU' AND type='Egreso'     THEN amount ELSE 0 END), 0) AS total_uyu,
        COALESCE(SUM(CASE WHEN currency='USD' AND type='Devolución' THEN amount ELSE 0 END), 0) AS devolucion_usd,
        COALESCE(SUM(CASE WHEN currency='UYU' AND type='Devolución' THEN amount ELSE 0 END), 0) AS devolucion_uyu
      FROM expenses
      WHERE payment_status = 'pagado' ${yc}
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    // TAXES by month
    const taxQuery = `
      SELECT year, month, razon_social,
             iva, irae, patrimonio, bps,
             (iva + irae + patrimonio + bps) AS total
      FROM taxes
      WHERE 1=1 ${yt}
      ORDER BY year DESC, month DESC
    `;

    const [cobros, expenses, taxes, socios] = await Promise.all([
      db.query(cobrosQuery, params),
      db.query(expenseQuery, params),
      db.query(taxQuery, params),
      db.query(sociosQuery, params),
    ]);

    res.json({
      cobros:   cobros.rows,
      expenses: expenses.rows,
      taxes:    taxes.rows,
      socios:   socios.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
