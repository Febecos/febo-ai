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
      m.created_at,
      m.direction,
      left(m.body, 90) as body,
      ct.phone,
      coalesce(ct.display_name, '') as display_name,
      c.ai_enabled,
      c.status
    from messages m
    left join contacts ct on ct.id = m.contact_id
    left join conversations c on c.id = m.conversation_id
    where m.created_at > now() - interval '6 hours'
    order by m.created_at desc
    limit 30
  `);

  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
