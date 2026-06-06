import OpenAI from "openai";
import { config, requireEnv } from "./config";
import { getSql, isDbConfigured } from "./db";

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return openaiClient;
}

export type FeboLearning = {
  id: string;
  topic: string;
  customer_pattern: string;
  how_to_respond: string;
  status: "pending" | "approved" | "rejected";
  source_sample: string | null;
  created_at: string;
};

let tableReady = false;
export async function ensureLearningsTable() {
  if (!isDbConfigured() || tableReady) return;
  const sql = getSql();
  await sql`
    create table if not exists febo_learnings (
      id uuid primary key default gen_random_uuid(),
      topic_key text unique not null,
      topic text not null,
      customer_pattern text not null,
      how_to_respond text not null,
      status text not null default 'pending',
      source_sample text,
      created_at timestamptz not null default now(),
      reviewed_by uuid,
      reviewed_at timestamptz
    )
  `;
  tableReady = true;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// Pares (consulta del cliente -> respuesta del asesor humano) de las ultimas horas.
async function collectTrainingPairs(sinceHours: number) {
  const sql = getSql();
  const rows = (await sql`
    with human as (
      select id, conversation_id, body, created_at
      from messages
      where direction in ('outbound', 'internal')
        and metadata->>'source' = 'manual'
        and created_at > now() - make_interval(hours => ${sinceHours})
        and length(trim(coalesce(body, ''))) > 12
      order by created_at desc
      limit 60
    )
    select
      h.body as agent_reply,
      (
        select string_agg(c.body, E'\n' order by c.created_at asc)
        from (
          select body, created_at
          from messages mi
          where mi.conversation_id = h.conversation_id
            and mi.direction = 'inbound'
            and length(trim(coalesce(mi.body, ''))) > 0
            and mi.created_at < h.created_at
          order by mi.created_at desc
          limit 3
        ) c
      ) as customer_context
    from human h
  `) as Array<{ agent_reply: string; customer_context: string | null }>;

  return rows.filter((r) => r.agent_reply && r.customer_context);
}

type DistilledLearning = { topic: string; customer_pattern: string; how_to_respond: string };

async function distillWithLlm(
  pairs: Array<{ agent_reply: string; customer_context: string | null }>,
  existingTopics: string[]
): Promise<DistilledLearning[]> {
  const sampleText = pairs
    .slice(0, 40)
    .map((p, i) => `#${i + 1}\nCLIENTE: ${p.customer_context}\nASESOR: ${p.agent_reply}`)
    .join("\n\n");

  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      "Sos un analista que destila aprendizajes para un bot de ventas de bombas solares (Febecos).",
      "Te paso pares reales de (consulta del cliente -> respuesta del asesor humano) en WhatsApp.",
      "Extrae aprendizajes GENERALIZABLES y reutilizables sobre COMO responder segun el tipo de consulta.",
      "Reglas duras: NO incluyas datos personales, nombres, telefonos ni precios concretos. NO incluyas casos unicos/irrepetibles. Cada aprendizaje debe servir para futuros clientes parecidos.",
      "Evita duplicar estos temas ya existentes: " + (existingTopics.join("; ") || "(ninguno)") + ".",
      "Devolve como maximo 6 aprendizajes nuevos y de alta calidad. Si no hay nada generalizable nuevo, devolve lista vacia.",
      "Cada aprendizaje: topic (titulo corto), customer_pattern (que tipo de consulta dispara esto), how_to_respond (como responder, en el tono del asesor).",
      "Responde SOLO JSON valido."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: sampleText }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "febo_learnings",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["learnings"],
          properties: {
            learnings: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["topic", "customer_pattern", "how_to_respond"],
                properties: {
                  topic: { type: "string" },
                  customer_pattern: { type: "string" },
                  how_to_respond: { type: "string" }
                }
              }
            }
          }
        },
        strict: true
      }
    }
  });

  try {
    const parsed = JSON.parse(response.output_text) as { learnings?: DistilledLearning[] };
    return Array.isArray(parsed.learnings) ? parsed.learnings : [];
  } catch {
    return [];
  }
}

// Corre el destilador: lee respuestas humanas recientes, destila y guarda como 'pending'.
export async function distillLearnings(sinceHours = 30) {
  if (!isDbConfigured()) {
    return { ok: false, reason: "db-not-configured", inserted: 0 };
  }
  await ensureLearningsTable();
  const sql = getSql();

  const pairs = await collectTrainingPairs(sinceHours);
  if (!pairs.length) {
    return { ok: true, inserted: 0, pairs: 0, reason: "no-pairs" };
  }

  const existing = (await sql`select topic from febo_learnings limit 200`) as Array<{ topic: string }>;
  const existingTopics = existing.map((e) => e.topic);

  const distilled = await distillWithLlm(pairs, existingTopics);
  let inserted = 0;

  for (const learning of distilled) {
    const topic = learning.topic?.trim();
    const customerPattern = learning.customer_pattern?.trim();
    const howTo = learning.how_to_respond?.trim();
    if (!topic || !customerPattern || !howTo) continue;
    const topicKey = normalizeKey(topic);
    if (!topicKey) continue;

    const result = (await sql`
      insert into febo_learnings (topic_key, topic, customer_pattern, how_to_respond, status)
      values (${topicKey}, ${topic}, ${customerPattern}, ${howTo}, 'pending')
      on conflict (topic_key) do nothing
      returning id
    `) as Array<{ id: string }>;
    if (result.length) inserted += 1;
  }

  return { ok: true, inserted, pairs: pairs.length, distilled: distilled.length };
}

export async function listLearnings(status?: "pending" | "approved" | "rejected") {
  if (!isDbConfigured()) return [];
  await ensureLearningsTable();
  const sql = getSql();
  const rows = status
    ? ((await sql`
        select id::text, topic, customer_pattern, how_to_respond, status, source_sample, created_at::text
        from febo_learnings where status = ${status}
        order by created_at desc limit 200
      `) as FeboLearning[])
    : ((await sql`
        select id::text, topic, customer_pattern, how_to_respond, status, source_sample, created_at::text
        from febo_learnings
        order by (status = 'pending') desc, created_at desc limit 200
      `) as FeboLearning[]);
  return rows;
}

export async function setLearningStatus(
  id: string,
  status: "approved" | "rejected" | "pending",
  reviewerUserId: string | null
) {
  if (!isDbConfigured()) return null;
  await ensureLearningsTable();
  const sql = getSql();
  const rows = (await sql`
    update febo_learnings
    set status = ${status}, reviewed_by = ${reviewerUserId}::uuid, reviewed_at = now()
    where id = ${id}::uuid
    returning id::text, status
  `) as Array<{ id: string; status: string }>;
  approvedCache = null;
  return rows[0] ?? null;
}

export async function updateLearning(
  id: string,
  fields: { topic?: string; customer_pattern?: string; how_to_respond?: string }
) {
  if (!isDbConfigured()) return null;
  await ensureLearningsTable();
  const sql = getSql();
  const rows = (await sql`
    update febo_learnings set
      topic = coalesce(${fields.topic ?? null}, topic),
      customer_pattern = coalesce(${fields.customer_pattern ?? null}, customer_pattern),
      how_to_respond = coalesce(${fields.how_to_respond ?? null}, how_to_respond)
    where id = ${id}::uuid
    returning id::text
  `) as Array<{ id: string }>;
  approvedCache = null;
  return rows[0] ?? null;
}

// Texto inyectable al prompt con SOLO los aprendizajes aprobados. Cacheado 60s.
let approvedCache: { text: string; at: number } | null = null;
export async function getApprovedLearningsText(nowMs: number): Promise<string> {
  if (!isDbConfigured()) return "";
  if (approvedCache && nowMs - approvedCache.at < 60_000) {
    return approvedCache.text;
  }
  try {
    await ensureLearningsTable();
    const sql = getSql();
    const rows = (await sql`
      select topic, customer_pattern, how_to_respond
      from febo_learnings where status = 'approved'
      order by created_at desc limit 80
    `) as Array<{ topic: string; customer_pattern: string; how_to_respond: string }>;

    const text = rows.length
      ? rows
          .map((r) => `## ${r.topic}\n- Cuando: ${r.customer_pattern}\n- Cómo responder: ${r.how_to_respond}`)
          .join("\n\n")
      : "";
    approvedCache = { text, at: nowMs };
    return text;
  } catch {
    return "";
  }
}
