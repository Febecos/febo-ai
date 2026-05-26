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
      left(m.body, 180) as body,
      ct.phone,
      coalesce(ct.display_name, '') as display_name,
      coalesce(u.full_name, u.email, '') as created_by,
      m.metadata->>'source' as source,
      m.metadata->>'whatsapp_status' as whatsapp_status,
      m.metadata->>'whatsapp_error_code' as whatsapp_error_code,
      m.metadata->>'whatsapp_error' as whatsapp_error,
      mm.mime_type,
      mm.filename,
      mm.file_size,
      mm.storage_provider,
      case when mm.media_url is null then false else true end as has_media_url,
      case when mm.data_base64 is null then 0 else length(mm.data_base64) end as data_base64_len
    from messages m
    left join contacts ct on ct.id = m.contact_id
    left join app_users u on u.id = m.created_by
    left join message_media mm on mm.message_id = m.id
    where m.created_at > now() - interval '36 hours'
      and (
        mm.mime_type ilike 'audio/%'
        or m.body ilike '%audio%'
        or m.body ilike '%Fallo WhatsApp%'
        or coalesce(u.full_name, u.email, '') ilike '%Rodrigo%'
      )
    order by m.created_at desc
    limit 80
  `);

  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
