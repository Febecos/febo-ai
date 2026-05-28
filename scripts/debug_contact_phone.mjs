import { Client } from "pg";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const phone = process.argv[2]?.replace(/\D/g, "");

if (!phone) {
  throw new Error("Uso: node scripts/debug_contact_phone.mjs 549...");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local o en el entorno.");
}

const variants = Array.from(new Set([
  phone,
  phone.replace(/^54/, "").replace(/^9/, ""),
  phone.replace(/^549/, "54"),
  phone.replace(/^549/, "")
].filter(Boolean)));
const patterns = variants.map((value) => `%${value}%`);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
});

await client.connect();

try {
  const contacts = await client.query(
    `
      select
        id::text,
        phone,
        display_name,
        platform,
        contact_type,
        sentiment,
        consultype,
        assigned_to::text,
        source,
        imported_from,
        imported_payload,
        last_seen_at::text,
        created_at::text,
        updated_at::text
      from contacts
      where regexp_replace(phone, '\\D', '', 'g') like any($1)
      order by updated_at desc
    `,
    [patterns]
  );

  const conversations = await client.query(
    `
      select
        c.id::text,
        c.contact_id::text,
        ct.phone,
        ct.display_name,
        c.status,
        c.ai_enabled,
        c.assigned_to::text,
        u.full_name assigned_name,
        c.last_message_at::text,
        c.created_at::text,
        c.updated_at::text,
        count(m.id)::int message_count,
        min(m.created_at)::text first_message,
        max(m.created_at)::text last_message
      from conversations c
      join contacts ct on ct.id = c.contact_id
      left join app_users u on u.id = c.assigned_to
      left join messages m on m.conversation_id = c.id
      where regexp_replace(ct.phone, '\\D', '', 'g') like any($1)
      group by c.id, ct.phone, ct.display_name, u.full_name
      order by c.last_message_at desc nulls last
    `,
    [patterns]
  );

  const messages = await client.query(
    `
      select
        m.id::text,
        m.conversation_id::text,
        m.direction,
        left(m.body, 240) body,
        m.metadata->>'source' as source,
        u.full_name as created_by_name,
        m.created_at::text,
        m.metadata
      from messages m
      join contacts ct on ct.id = m.contact_id
      left join app_users u on u.id = m.created_by
      where regexp_replace(ct.phone, '\\D', '', 'g') like any($1)
      order by m.created_at desc
      limit 80
    `,
    [patterns]
  );

  console.log(JSON.stringify({
    ok: true,
    phone,
    variants,
    contacts: contacts.rows,
    conversations: conversations.rows,
    recentMessages: messages.rows
  }, null, 2));
} finally {
  await client.end();
}
