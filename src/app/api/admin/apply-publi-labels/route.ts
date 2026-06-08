import { type NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

const TOKEN = "febo-publi-2026";

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

async function handler(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const sql = getSql();

  // Upsert etiqueta lead-publi (INSERT ignorando si ya existe)
  await sql`
    INSERT INTO label_definitions (slug, name, color, instructions, active, sort_order)
    VALUES ('lead-publi', 'Lead Publi', '#a855f7',
      'Vino de un anuncio de Meta y ya recibio la respuesta automatica con links de ficha, catalogo y selector.',
      true, 15)
    ON CONFLICT (slug) DO NOTHING
  `;

  // Candidatos: conversaciones de últimas 48hs con mensaje de publi
  // DISTINCT ON requiere ORDER BY con la misma columna primero
  const rows = await sql`
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id as id,
      c.contact_name as name,
      c.consultype
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.created_at >= NOW() - INTERVAL '48 hours'
      AND m.body ILIKE '%Vino de un anuncio de Meta%'
    ORDER BY m.conversation_id
  ` as Array<{ id: string; name: string; consultype: string }>;

  const ids = rows.map(r => r.id);
  const total = ids.length;

  if (total === 0) {
    return NextResponse.json({ updated: 0, total_candidates: 0, message: "No se encontraron conversaciones de publi en las ultimas 48hs." });
  }

  // Actualizar solo estados iniciales
  const updated = await sql`
    UPDATE conversations
    SET consultype = 'lead-publi', updated_at = NOW()
    WHERE id = ANY(${ids})
      AND (consultype IS NULL OR consultype IN ('saludo','informacion','pasar-presupuesto','otro',''))
    RETURNING id, contact_name as name
  ` as Array<{ id: string; name: string }>;

  return NextResponse.json({
    updated: updated.length,
    total_candidates: total,
    skipped: total - updated.length,
    names: updated.map(r => r.name)
  });
}
