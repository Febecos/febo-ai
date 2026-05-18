import pg from "pg";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local o en el entorno.");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
});

await client.connect();

try {
  const result = await client.query(`
    select
      (select count(*)::int from app_users) as users,
      (select count(*)::int from contacts) as contacts,
      (select count(*)::int from conversations) as conversations,
      (select count(*)::int from messages) as messages,
      (select count(*)::int from contacts where imported_from = 'hariaz') as hariaz_contacts
  `);
  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  await client.end();
}
