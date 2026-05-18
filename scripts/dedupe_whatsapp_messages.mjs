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
    with ranked as (
      select
        id,
        row_number() over (
          partition by wa_message_id
          order by created_at asc, id asc
        ) as rn
      from messages
      where wa_message_id is not null
    ),
    deleted as (
      delete from messages
      where id in (select id from ranked where rn > 1)
      returning id
    )
    select count(*)::int as deleted_count
    from deleted;
  `);

  console.log(`Mensajes duplicados eliminados: ${result.rows[0].deleted_count}`);
} finally {
  await client.end();
}
