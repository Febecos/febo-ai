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

  try {
    // Crear etiqueta solo si no existe (sin ON CONFLICT para evitar problemas de constraint)
    const existingLabel = await sql`
      SELECT slug FROM label_definitions WHERE slug = 'lead-publi' LIMIT 1
    `;
    const labelRows = Array.isArray(existingLabel) ? existingLabel : [];
    if (labelRows.length === 0) {
      await sql`
        INSERT INTO label_definitions (slug, name, color, instructions, active, sort_order)
        VALUES ('lead-publi', 'Lead Publi', '#a855f7',
          'Vino de un anuncio de Meta y ya recibio la respuesta automatica con links de ficha, catalogo y selector.',
          true, 15)
      `;
    }

    // Candidatos: conversaciones de últimas 48hs con mensaje de publi
    const rowsRaw = await sql`
      SELECT DISTINCT ON (c.contact_id)
        c.contact_id as id,
        ct.display_name as name,
        ct.consultype
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE m.created_at >= NOW() - INTERVAL '48 hours'
        AND m.body ILIKE '%Vino de un anuncio de Meta%'
      ORDER BY c.contact_id
    `;
    const rows = Array.isArray(rowsRaw) ? rowsRaw as Array<{ id: string; name: string; consultype: string }> : [];

    const ids = rows.map(r => r.id);
    const total = ids.length;

    if (total === 0) {
      return NextResponse.json({ updated: 0, total_candidates: 0, message: "Sin conversaciones de publi en las ultimas 48hs." });
    }

    // Actualizar solo estados iniciales
    const updatedRaw = await sql`
      UPDATE contacts
      SET consultype = 'lead-publi', updated_at = NOW()
      WHERE id = ANY(${ids})
        AND (consultype IS NULL OR consultype IN ('saludo','informacion','pasar-presupuesto','otro',''))
      RETURNING id
    `;
    const updated = Array.isArray(updatedRaw) ? updatedRaw as Array<{ id: string }> : [];

    return NextResponse.json({
      updated: updated.length,
      total_candidates: total,
      skipped: total - updated.length,
      names: rows.filter(r => updated.some(u => u.id === r.id)).map(r => r.name)
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
