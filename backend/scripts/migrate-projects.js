// =============================================
// MIGRACIÓN DE PROYECTOS - Excel → PostgreSQL
// Zoonotic Administration App
// =============================================
// Uso:
//   npm install pg xlsx dotenv
//   node migrate-projects.js
//
// Requiere un archivo .env con DATABASE_URL:
//   DATABASE_URL=postgresql://user:pass@host:5432/dbname

require("dotenv").config();
const { Pool } = require("pg");
const XLSX = require("xlsx");
const path = require("path");

// ── Configuración ────────────────────────────────────────────────────────────

const EXCEL_PATH = path.join(__dirname, "Proyectos.xlsx");
const SHEET_NAME = "Hoja1"; // Nombre de la pestaña

// Mapeos de valores del Excel → valores válidos en la DB
const STATUS_MAP = {
  Cobrado: "Cobrado",
  "Falta Cotizar": "Falta Cotizar",
  "Falta OC": "Falta OC",
  Facturado: "Facturado",
  "En Ejecución": "En Ejecución",
  "Propuesta NO Enviada": "Falta Cotizar", // No existe en el schema → mapeado
};

const TYPE_MAP = {
  Proyecto: "Proyecto cerrado",
  Horas: "Tiempo y materiales",
};

const EMPRESA_MAP = {
  ZOONOTIC: "Zoonotic",
  INGEUY: "Ingeuy",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convierte fechas del Excel. Las fechas con año 1900 son artefactos de celdas
 * vacías en Excel y se descartan.
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (val.getFullYear() === 1900) return null;
    return val.toISOString().split("T")[0]; // YYYY-MM-DD
  }
  return null;
}

/**
 * Convierte montos. Los valores '-' o null se convierten a 0.
 */
function parseMonto(val) {
  if (val === null || val === undefined || val === "-" || val === "") return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza el nombre del owner del Excel para buscar en collaborators.
 * Retorna un array con los owners (puede ser más de uno si es "Leandro/Z2").
 * Cada elemento es { type: 'Z2' | 'Colaborador', name?: string }
 */
function parseOwners(ownerStr) {
  if (!ownerStr) return [{ type: "Z2" }];

  const parts = ownerStr.split("/").map((p) => p.trim());
  return parts.map((p) => {
    if (p === "Z2") return { type: "Z2" };
    return { type: "Colaborador", name: p };
  });
}

// ── Lógica de DB ──────────────────────────────────────────────────────────────

/** Busca un cliente por nombre exacto. Si no existe, lo crea. */
async function findOrCreateClient(pool, name) {
  const res = await pool.query("SELECT id FROM clients WHERE name = $1", [
    name,
  ]);
  if (res.rows.length > 0) return res.rows[0].id;

  const insert = await pool.query(
    "INSERT INTO clients (name) VALUES ($1) RETURNING id",
    [name]
  );
  console.log(`  ✅ Cliente creado: "${name}" (id=${insert.rows[0].id})`);
  return insert.rows[0].id;
}

/** Busca un colaborador por nombre. Si no existe, lo crea como activo. */
async function findOrCreateCollaborator(pool, name) {
  const res = await pool.query(
    "SELECT id FROM collaborators WHERE name ILIKE $1",
    [name]
  );
  if (res.rows.length > 0) return res.rows[0].id;

  const insert = await pool.query(
    "INSERT INTO collaborators (name, active) VALUES ($1, TRUE) RETURNING id",
    [name]
  );
  console.log(
    `  ✅ Colaborador creado: "${name}" (id=${insert.rows[0].id})`
  );
  return insert.rows[0].id;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Validar que existe DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error("❌ No se encontró DATABASE_URL en el archivo .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Leer el Excel
  console.log(`\n📂 Leyendo archivo: ${EXCEL_PATH}`);
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    console.error(`❌ No se encontró la pestaña "${SHEET_NAME}" en el Excel.`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headers = rows[0];
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null));

  console.log(`📊 Filas a migrar: ${dataRows.length}\n`);

  // Contadores
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // +2 porque empezamos desde la fila 2 del Excel

    // Mapear columnas por posición (según header)
    const get = (colName) => {
      const idx = headers.indexOf(colName);
      return idx !== -1 ? row[idx] : null;
    };

    const nombreProyecto = get("Proyecto");
    if (!nombreProyecto) {
      console.warn(`  ⚠️  Fila ${rowNum}: sin nombre de proyecto, se omite.`);
      skipped++;
      continue;
    }

    console.log(`\n🔄 Fila ${rowNum}: "${nombreProyecto}"`);

    try {
      await pool.query("BEGIN");

      // 1. Cliente
      const empleador = get("Empleador");
      let clientId = null;
      if (empleador) {
        clientId = await findOrCreateClient(pool, empleador);
      }

      // 2. Insertar proyecto
      const rawStatus = get("Estado");
      const status = STATUS_MAP[rawStatus] ?? "Falta Cotizar";
      if (!STATUS_MAP[rawStatus]) {
        console.warn(
          `  ⚠️  Estado desconocido "${rawStatus}" → mapeado a "Falta Cotizar"`
        );
      }

      const rawType = get("Tipo");
      const type = TYPE_MAP[rawType] ?? null;

      const rawEmpresa = get("Empresa");
      const razonSocial = rawEmpresa ? EMPRESA_MAP[rawEmpresa.toUpperCase()] ?? null : null;

      const po = get("PO");
      const invoiceNum = get("N° Factura");

      const projectRes = await pool.query(
        `INSERT INTO projects (
          name, status, client_id, requestor, po, quote_file, type,
          hours_estimated, billing_date, razon_social, invoice_number,
          currency, subtotal_usd, iva_usd, total_usd,
          subtotal_uyu, iva_uyu, total_uyu,
          possible_payment_date, actual_payment_date
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,
          $12,$13,$14,$15,
          $16,$17,$18,
          $19,$20
        ) RETURNING id`,
        [
          nombreProyecto,                         // $1  name
          status,                                 // $2  status
          clientId,                               // $3  client_id
          get("Solicitante"),                     // $4  requestor
          po ? String(po) : null,                 // $5  po
          get("Archivo"),                         // $6  quote_file
          type,                                   // $7  type
          parseMonto(get("Horas / Dias")) || null,// $8  hours_estimated
          parseDate(get("Fecha de Facturacion")), // $9  billing_date
          razonSocial,                            // $10 razon_social
          invoiceNum ? String(invoiceNum) : null, // $11 invoice_number
          get("Moneda") || "UYU",                 // $12 currency
          parseMonto(get("Subtotal USD")),         // $13 subtotal_usd
          parseMonto(get("IVA USD")),              // $14 iva_usd
          parseMonto(get("Total USD")),            // $15 total_usd
          parseMonto(get("Subtotal UYU")),         // $16 subtotal_uyu
          parseMonto(get("IVA $UYU")),             // $17 iva_uyu
          parseMonto(get("Total $UYU")),           // $18 total_uyu
          parseDate(get("Fecha Posible cobro")),   // $19 possible_payment_date
          parseDate(get("Fecha cobrado")),         // $20 actual_payment_date
        ]
      );

      const projectId = projectRes.rows[0].id;
      console.log(`  ✅ Proyecto insertado (id=${projectId})`);

      // 3. Project owners
      const ownerStr = get("Owner");
      const owners = parseOwners(ownerStr);

      for (const owner of owners) {
        if (owner.type === "Z2") {
          await pool.query(
            `INSERT INTO project_owners (project_id, owner_type) VALUES ($1, 'Z2')`,
            [projectId]
          );
          console.log(`  👤 Owner: Z2`);
        } else {
          const collabId = await findOrCreateCollaborator(pool, owner.name);
          await pool.query(
            `INSERT INTO project_owners (project_id, owner_type, collaborator_id) VALUES ($1, 'Colaborador', $2)`,
            [projectId, collabId]
          );
          console.log(`  👤 Owner: ${owner.name} (colaborador id=${collabId})`);
        }
      }

      await pool.query("COMMIT");
      inserted++;
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`  ❌ Error en fila ${rowNum}: ${err.message}`);
      errors++;
    }
  }

  await pool.end();

  // Resumen
  console.log("\n════════════════════════════════════════");
  console.log("📋 RESUMEN DE MIGRACIÓN");
  console.log("════════════════════════════════════════");
  console.log(`  ✅ Proyectos insertados: ${inserted}`);
  console.log(`  ⏭️  Omitidos:            ${skipped}`);
  console.log(`  ❌ Con errores:          ${errors}`);
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
