import pg from "pg";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const phone = process.argv[2]?.replace(/\D/g, "");

if (!phone) {
  throw new Error("Uso: node scripts/reactivate_contact.mjs <telefono>");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local o en el entorno.");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
});

await client.connect();

try {
  await client.query("begin");

  const result = await client.query(
    `
      update conversations c
      set ai_enabled = true,
          status = 'open',
          assigned_to = null,
          updated_at = now()
      from contacts ct
      where c.contact_id = ct.id
        and ct.phone = $1
        and c.status in ('open', 'waiting', 'quoted', 'hot', 'handoff')
      returning c.id::text
    `,
    [phone]
  );

  await client.query(
    `
      update contacts
      set assigned_to = null,
          updated_at = now()
      where phone = $1
    `,
    [phone]
  );

  await client.query("commit");
  console.log(JSON.stringify({ ok: true, phone, conversations: result.rows.map((row) => row.id) }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
