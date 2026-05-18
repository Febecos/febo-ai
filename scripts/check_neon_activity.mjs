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
      pid,
      state,
      wait_event_type,
      wait_event,
      now() - query_start as running_for,
      left(query, 220) as query
    from pg_stat_activity
    where datname = current_database()
      and pid <> pg_backend_pid()
    order by query_start nulls last
  `);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
