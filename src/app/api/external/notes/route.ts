// src/app/api/external/notes/route.ts
// Endpoint externo para crear/leer notas internas desde sistemas externos
// (selector, admin de Febecos) sin requerir sesión de usuario.
//
// POST /api/external/notes
//   Body: { phone, conversationId?, body, source? }
//   Crea una nota interna en la conversación del contacto.
//   Si solo viene phone, busca la conversación abierta más reciente.
//   Si viene conversationId, la usa directamente.
//
// GET /api/external/notes?conversationId=UUID
//   Lista las notas de esa conversación.
//
// Auth: Authorization: Bearer <FEBECOS_EXTERNAL_TOKEN>
//
// Env vars:
//   FEBECOS_EXTERNAL_TOKEN — token compartido con el selector/admin

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql, isDbConfigured } from "@/lib/db";
import { normalizeWhatsAppRecipient, listConversationNotes } from "@/lib/crm";

// ── Validar Bearer token ──────────────────────────────────────────────────────
function validateToken(request: NextRequest): boolean {
  const expected = process.env.FEBECOS_EXTERNAL_TOKEN;
  if (!expected) {
    // Sin token configurado → rechazar siempre (no modo permisivo en externo)
    return false;
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === expected;
}

// ── Buscar conversación abierta por teléfono ──────────────────────────────────
async function findOpenConversationByPhone(phone: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const sql = getSql();
  const normalized = normalizeWhatsAppRecipient(phone);

  const rows = (await sql`
    select c.id::text as conversation_id
    from conversations c
    join contacts ct on ct.id = c.contact_id
    where ct.phone = ${normalized}
      and c.status in ('open', 'waiting', 'quoted', 'hot', 'handoff')
    order by c.last_message_at desc
    limit 1
  `) as Array<{ conversation_id: string }>;

  return rows[0]?.conversation_id ?? null;
}

// ── POST — crear nota interna ─────────────────────────────────────────────────
const postSchema = z.object({
  phone:          z.string().min(6).optional(),
  conversationId: z.string().uuid().optional(),
  body:           z.string().trim().min(1).max(2000),
  source:         z.string().optional().default("selector-admin"),
}).refine(d => d.phone || d.conversationId, {
  message: "Se requiere phone o conversationId",
});

export async function POST(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Payload inválido." }, { status: 400 });
  }

  const { phone, conversationId: rawConvId, body, source } = parsed.data;

  // Resolver conversationId
  let conversationId = rawConvId ?? null;
  if (!conversationId && phone) {
    conversationId = await findOpenConversationByPhone(phone);
  }

  if (!conversationId) {
    return NextResponse.json(
      { ok: false, error: "No se encontró conversación abierta para ese contacto." },
      { status: 404 }
    );
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Base de datos no configurada." }, { status: 500 });
  }

  const sql = getSql();

  // Insertar nota con created_by = null (nota de sistema externo) y source marcado
  const rows = (await sql`
    insert into conversation_notes (conversation_id, created_by, body, source)
    values (${conversationId}, null, ${body}, ${source})
    on conflict do nothing
    returning id::text
  `) as Array<{ id: string }>;

  // Fallback si la columna source no existe aún (migration no corrida)
  const noteId = rows[0]?.id ?? null;
  if (!noteId) {
    // Intentar sin columna source
    const rows2 = (await sql`
      insert into conversation_notes (conversation_id, created_by, body)
      values (${conversationId}, null, ${body})
      returning id::text
    `) as Array<{ id: string }>;
    const fallbackId = rows2[0]?.id ?? null;
    return NextResponse.json({ ok: true, conversationId, noteId: fallbackId });
  }

  return NextResponse.json({ ok: true, conversationId, noteId });
}

// ── GET — listar notas de una conversación ────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requerido." }, { status: 400 });
  }

  return NextResponse.json({
    notes: await listConversationNotes(conversationId),
  });
}
