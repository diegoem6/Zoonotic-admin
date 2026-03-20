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
      possible_payment_date, actual_payment_date, owners = []
    } = req.body;

    await conn.query('BEGIN');

    const result = await conn.query(`
      INSERT INTO projects (name, status, client_id, requestor, po, type, hours_estimated,
        iva_rate, billing_date, razon_social, invoice_number, currency,
        subtotal_usd, iva_usd, total_usd, subtotal_uyu, iva_uyu, total_uyu,
        possible_payment_date, actual_payment_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [name, status || 'Falta Cotizar', client_id || null, requestor, po, type, hours_estimated || null,
        iva_rate !== undefined ? iva_rate : 0.22,
        billing_date || null, razon_social, invoice_number,
        currency, subtotal_usd || 0, iva_usd || 0, total_usd || 0,
        subtotal_uyu || 0, iva_uyu || 0, total_uyu || 0,
        possible_payment_date || null, actual_payment_date || null]);

    const project = result.rows[0];

    // Insert owners
    for (const owner of owners) {
      await conn.query(
        'INSERT INTO project_owners (project_id, owner_type, collaborator_id) VALUES ($1,$2,$3)',
        [project.id, owner.owner_type, owner.collaborator_id || null]
      );
    }

    // Auto-generate expense if Ingeuy and has billing_date
    if (razon_social === 'Ingeuy' && billing_date && (subtotal_usd > 0 || subtotal_uyu > 0)) {
      await autoGenerateIngeuyExpense(conn, project);
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
      possible_payment_date, actual_payment_date, owners = []
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
        possible_payment_date=$19, actual_payment_date=$20, updated_at=NOW()
      WHERE id=$21 RETURNING *
    `, [name, status, client_id || null, requestor, po, type, hours_estimated || null,
        iva_rate !== undefined ? iva_rate : 0.22,
        billing_date || null, razon_social, invoice_number, currency,
        subtotal_usd || 0, iva_usd || 0, total_usd || 0,
        subtotal_uyu || 0, iva_uyu || 0, total_uyu || 0,
        possible_payment_date || null, actual_payment_date || null, id]);

    const project = result.rows[0];

    // Replace owners
    await conn.query('DELETE FROM project_owners WHERE project_id=$1', [id]);
    for (const owner of owners) {
      await conn.query(
        'INSERT INTO project_owners (project_id, owner_type, collaborator_id) VALUES ($1,$2,$3)',
        [id, owner.owner_type, owner.collaborator_id || null]
      );
    }

    // Handle auto-expense for Ingeuy: if billing_date was added/changed and razon is Ingeuy
    const billingChanged = billing_date && (prevProject.billing_date?.toISOString().split('T')[0] !== billing_date || prevProject.razon_social !== 'Ingeuy');
    if (razon_social === 'Ingeuy' && billing_date && billingChanged) {
      // Delete old auto-generated expense for this project
      await conn.query('DELETE FROM expenses WHERE project_id=$1 AND auto_generated=TRUE', [id]);
      await autoGenerateIngeuyExpense(conn, project);
    } else if (razon_social !== 'Ingeuy') {
      // If changed away from Ingeuy, remove auto expense
      await conn.query('DELETE FROM expenses WHERE project_id=$1 AND auto_generated=TRUE', [id]);
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
      SELECT collaborator_id, col.name as collaborator_name, SUM(hours) as total_hours
      FROM project_hours ph
      JOIN collaborators col ON col.id = ph.collaborator_id
      WHERE project_id = $1
      GROUP BY collaborator_id, col.name
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
    const { collaborator_id, hours, date, description } = req.body;
    const result = await db.query(
      'INSERT INTO project_hours (project_id, collaborator_id, hours, date, description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, collaborator_id, hours, date || null, description]
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

// Helper: auto-generate Ingeuy expense for Diego Ricca (Socio)
async function autoGenerateIngeuyExpense(conn, project) {
  // Find Diego Ricca (Socio) collaborator
  const diegoResult = await conn.query(
    "SELECT id FROM collaborators WHERE name ILIKE 'Diego Ricca' AND condition='Socio' LIMIT 1"
  );
  if (diegoResult.rows.length === 0) {
    console.warn('Diego Ricca (Socio) not found - skipping auto-expense generation');
    return;
  }
  const diegoId = diegoResult.rows[0].id;

  // Determine amount and currency based on project
  const amount = project.currency === 'USD' ? project.subtotal_usd : project.subtotal_uyu;
  const currency = project.currency || 'USD';

  await conn.query(`
    INSERT INTO expenses (date, description, amount, currency, collaborator_id, comment, auto_generated, project_id, type)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, 'Egreso')
  `, [
    project.billing_date,
    `Pago proyecto Ingeuy: ${project.name}`,
    amount,
    currency,
    diegoId,
    'Generado automáticamente por facturación Ingeuy',
    project.id
  ]);
}

module.exports = router;
