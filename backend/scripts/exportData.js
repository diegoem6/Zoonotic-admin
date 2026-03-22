/**
 * Export all data from local DB as a SQL file ready to import in production.
 * Usage: node scripts/exportData.js
 * Output: scripts/export_YYYY-MM-DD.sql
 */
const path = require('path');
const fs = require('fs');

// Cargar .env manualmente para evitar problemas de ruta con dotenv
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
} else {
  console.error('No se encontró el archivo .env en:', envPath);
  process.exit(1);
}

console.log('ENV PATH:', envPath);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportTable(client, tableName, columns) {
  const { rows } = await client.query(`SELECT ${columns.join(', ')} FROM ${tableName} ORDER BY id`);
  if (rows.length === 0) return `-- ${tableName}: sin datos\n`;

  const lines = rows.map(row => {
    const vals = columns.map(c => escape(row[c])).join(', ');
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${vals});`;
  });

  return `-- ${tableName} (${rows.length} registros)\n` + lines.join('\n') + '\n';
}

async function main() {
  const client = await pool.connect();
  const date = new Date().toISOString().slice(0, 10);
  const outFile = path.join(__dirname, `export_${date}.sql`);
  const parts = [];

  parts.push(`-- =============================================`);
  parts.push(`-- Z2 DATA EXPORT - ${date}`);
  parts.push(`-- Importar con: psql -U <user> -d <db> -f export_${date}.sql`);
  parts.push(`-- =============================================\n`);
  parts.push(`SET session_replication_role = replica; -- deshabilita FK checks temporalmente\n`);

  // Limpiar datos existentes en orden inverso a las FK
  parts.push(`-- Eliminar datos existentes`);
  parts.push(`TRUNCATE TABLE taxes, expenses, project_hours, project_owners, projects, client_referentes, collaborators, clients RESTART IDENTITY CASCADE;\n`);

  try {
    // Orden respeta foreign keys
    parts.push(await exportTable(client, 'clients', ['id', 'name', 'rut', 'description', 'created_at', 'updated_at']));
    parts.push(await exportTable(client, 'client_referentes', ['id', 'client_id', 'name', 'email', 'phone']));
    parts.push(await exportTable(client, 'collaborators', ['id', 'name', 'start_date', 'email', 'condition', 'active', 'created_at', 'updated_at']));
    parts.push(await exportTable(client, 'projects', [
      'id', 'name', 'status', 'client_id', 'requestor', 'po', 'quote_file', 'type',
      'hours_estimated', 'iva_rate', 'billing_date', 'razon_social', 'invoice_number',
      'currency', 'subtotal_usd', 'iva_usd', 'total_usd', 'subtotal_uyu', 'iva_uyu', 'total_uyu',
      'possible_payment_date', 'actual_payment_date', 'created_at', 'updated_at'
    ]));
    parts.push(await exportTable(client, 'project_owners', ['id', 'project_id', 'owner_type', 'collaborator_id']));
    parts.push(await exportTable(client, 'project_hours', ['id', 'project_id', 'collaborator_id', 'hours', 'date', 'description', 'created_at']));
    parts.push(await exportTable(client, 'expenses', [
      'id', 'date', 'description', 'amount', 'currency', 'collaborator_id',
      'comment', 'auto_generated', 'project_id', 'type', 'created_at', 'updated_at'
    ]));
    parts.push(await exportTable(client, 'taxes', [
      'id', 'month', 'year', 'razon_social', 'iva', 'iva_manual_override',
      'irae', 'patrimonio', 'bps', 'notes', 'created_at', 'updated_at'
    ]));

    // Resetear sequences para que los IDs futuros no colisionen
    parts.push(`\n-- Resetear sequences al valor maximo de cada tabla`);
    const tables = ['clients', 'client_referentes', 'collaborators', 'projects', 'project_owners', 'project_hours', 'expenses', 'taxes'];
    for (const t of tables) {
      parts.push(`SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id) FROM ${t}), 1));`);
    }

    parts.push(`\nSET session_replication_role = DEFAULT; -- reactiva FK checks`);
    parts.push(`\n-- Export completo.`);

    fs.writeFileSync(outFile, parts.join('\n'));
    console.log(`\nExport generado: ${outFile}`);
    console.log(`\nPara importar en produccion:`);
    console.log(`  psql -h <host> -U <user> -d <db> -f ${path.basename(outFile)}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
