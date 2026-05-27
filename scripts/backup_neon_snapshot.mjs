import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local o en el entorno.");
}

const BACKUP_ROOT = path.join(process.cwd(), "backups", "neon");
// Tablas livianas — se respaldan siempre
const TABLES = [
  "app_users",
  "channel_accounts",
  "contacts",
  "conversations",
  "messages",
  "conversation_memory",
  "conversation_notes",
  "quick_replies",
  "push_subscriptions",
  "handoffs",
  "follow_ups",
  "platform_events",
  "message_templates",
  "label_definitions",
  "app_settings"
];

// Tablas pesadas (base64 media) — solo con flag --full
const HEAVY_TABLES = [
  "message_media",
];

const isFullBackup = process.argv.includes("--full");
const tablesToBackup = isFullBackup ? [...TABLES, ...HEAVY_TABLES] : TABLES;

function stampDate(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

const snapshotId = process.argv.find((arg) => arg.startsWith("--name="))?.slice("--name=".length) || stampDate();
const snapshotDir = path.join(BACKUP_ROOT, snapshotId);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
});

await mkdir(snapshotDir, { recursive: true });
await client.connect();

const manifest = {
  snapshotId,
  createdAt: new Date().toISOString(),
  database: "neon",
  tables: {},
  notes: [
    "Snapshot JSON creado antes/despues de cambios de FEBO.",
    "No incluye secretos de entorno.",
    isFullBackup
      ? "Backup COMPLETO: incluye message_media (base64 pesado)."
      : "Backup liviano: message_media excluida. Usar --full para incluirla."
  ]
};

try {
  for (const table of tablesToBackup) {
    const exists = await client.query(
      "select to_regclass($1) as table_name",
      [`public.${table}`]
    );

    if (!exists.rows[0]?.table_name) {
      manifest.tables[table] = { exists: false, rows: 0 };
      continue;
    }

    const rows = await client.query(`select * from ${table} order by 1`);
    manifest.tables[table] = { exists: true, rows: rows.rowCount };
    await writeFile(
      path.join(snapshotDir, `${table}.json`),
      JSON.stringify(rows.rows, null, 2),
      "utf8"
    );
  }

  await writeFile(
    path.join(snapshotDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log(JSON.stringify({
    ok: true,
    snapshotId,
    path: snapshotDir,
    tables: manifest.tables
  }, null, 2));
} finally {
  await client.end();
}
