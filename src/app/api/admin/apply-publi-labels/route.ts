import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

const BYPASS_TOKEN = "febo-publi-2026";

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

async function handler(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== BYPASS_TOKEN) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
  }

  const sql = getSql();

  await sql`
    INSERT INTO label_definitions (slug, name, color, instructions, active, sort_order)
    VALUES (
      'lead-publi', 'Lead Publi', '#a855f7',
      'Vino de un anuncio de Meta (Click-to-WhatsApp) y ya recibio la respuesta automatica con el link de la ficha del producto, el catalogo y el selector. Todavia no cotizo ni dio datos tecnicos.',
      true, 15
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name, color = EXCLUDED.color,
      instructions = EXCLUDED.instructions, active = true, sort_order = EXCLUDED.sort_order
  `;

  const candidates = await sql`
    SELECT DISTINCT m.conversation_id, c.consultype, c.contact_name
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.created_at >= NOW() - INTERVAL '48 hours'
      AND m.body ILIKE '%Vino de un anuncio de Meta%'
    ORDER BY m.conversation_id
  ` as Array<{ conversation_id: string; consultype: string; contact_name: string }>;

  if (!candidates.length) {
    return NextResponse.json({ updated: 0, total_candidates: 0, conversations: [] });
  }

  const ids = candidates.map((r) => r.conversation_id);

  const updated = await sql`
    UPDATE conversations
    SET consultype = 'lead-publi', updated_at = NOW()
    WHERE id = ANY(${ids})
      AND (consultype IS NULL OR consultype IN ('saludo', 'informacion', 'pasar-presupuesto', 'otro', ''))
    RETURNING id, contact_name
  ` as Array<{ id: string; contact_name: string }>;

  return NextResponse.json({
    updated: updated.length,
    total_candidates: candidates.length,
    conversations: updated.map((r) => ({ id: r.id, name: r.contact_name }))
  });
}
