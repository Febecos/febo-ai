import pg from "pg";
import xlsx from "xlsx";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local o en el entorno.");
}

const inputFile = process.argv[2] ?? "Hariaz/prospectos_2026-05-18.xlsx";

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeConsultype(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

  if (!normalized) {
    return "otro";
  }

  if (normalized === "comprador") {
    return "caliente";
  }

  const allowed = new Set([
    "saludo",
    "informacion",
    "disponibilidad",
    "accion",
    "problema",
    "seguimiento",
    "caliente",
    "comparador",
    "reserva-7-dias",
    "sin-perforacion",
    "proyecto-futuro",
    "tecnico-revendedor",
    "otro"
  ]);

  return allowed.has(normalized) ? normalized : "otro";
}

function normalizeSentiment(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "positivo" || normalized === "muy-positivo") {
    return "positivo";
  }

  if (normalized === "negativo") {
    return "preocupado";
  }

  if (normalized === "muy-negativo" || normalized === "molesto") {
    return "molesto";
  }

  return "neutral";
}

const workbook = xlsx.readFile(inputFile);
const sheet = workbook.Sheets.Contactos ?? workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
const deduped = new Map();
let skipped = 0;

for (const row of rows) {
  const phone = normalizePhone(row.USER_ID);

  if (!phone) {
    skipped += 1;
    continue;
  }

  deduped.set(phone, {
    phone,
    display_name: String(row.NOMBRE ?? "").trim() || null,
    platform: String(row.PLATFORM ?? "whatsapp").trim().toLowerCase() || "whatsapp",
    contact_type: String(row.TIPO ?? "Prospecto").trim().toLowerCase() || "prospecto",
    sentiment: normalizeSentiment(row.SENTIMIENTO),
    consultype: normalizeConsultype(row.CONSULTYPE),
    payload: row
  });
}

const records = [...deduped.values()];

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
});

await client.connect();

try {
  await client.query("begin");
  await client.query(`
    create temporary table tmp_hariaz_contacts (
      phone text primary key,
      display_name text,
      platform text,
      contact_type text,
      sentiment text,
      consultype text,
      payload jsonb
    ) on commit drop
  `);

  for (let index = 0; index < records.length; index += 500) {
    const chunk = records.slice(index, index + 500);
    const values = [];
    const placeholders = chunk
      .map((record, rowIndex) => {
        const offset = rowIndex * 7;
        values.push(
          record.phone,
          record.display_name,
          record.platform,
          record.contact_type,
          record.sentiment,
          record.consultype,
          JSON.stringify(record.payload)
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${
          offset + 7
        }::jsonb)`;
      })
      .join(",");

    await client.query(
      `
        insert into tmp_hariaz_contacts (
          phone,
          display_name,
          platform,
          contact_type,
          sentiment,
          consultype,
          payload
        )
        values ${placeholders}
        on conflict (phone) do update
        set display_name = excluded.display_name,
            platform = excluded.platform,
            contact_type = excluded.contact_type,
            sentiment = excluded.sentiment,
            consultype = excluded.consultype,
            payload = excluded.payload
      `,
      values
    );
  }

  await client.query(`
    insert into contacts (
      phone,
      display_name,
      platform,
      contact_type,
      sentiment,
      consultype,
      imported_from,
      imported_payload
    )
    select
      phone,
      display_name,
      platform,
      contact_type,
      sentiment,
      consultype,
      'hariaz',
      payload
    from tmp_hariaz_contacts
    on conflict (phone) do update
    set display_name = coalesce(nullif(excluded.display_name, ''), contacts.display_name),
        platform = excluded.platform,
        contact_type = excluded.contact_type,
        sentiment = excluded.sentiment,
        consultype = excluded.consultype,
        imported_from = 'hariaz',
        imported_payload = excluded.imported_payload,
        updated_at = now()
  `);

  await client.query(`
    insert into conversations (contact_id, status, ai_enabled, last_message_at)
    select contacts.id, 'open', true, now()
    from contacts
    join tmp_hariaz_contacts on tmp_hariaz_contacts.phone = contacts.phone
    on conflict do nothing
  `);

  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

console.log(`Importados/actualizados: ${records.length}`);
console.log(`Omitidos sin telefono: ${skipped}`);
console.log(`Duplicados consolidados: ${rows.length - skipped - records.length}`);
