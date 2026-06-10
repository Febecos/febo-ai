import { type NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

const TOKEN = process.env.ADMIN_TOOLS_TOKEN || ""; // rotar el valor comprometido 'febo-publi-2026'

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

async function handler(req: NextRequest) {
  if (!TOKEN || req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const sql = getSql();

  try {
    // label_definitions.slug es primary key → ON CONFLICT (slug) funciona
    await sql`
      INSERT INTO label_definitions (slug, name, color, instructions, active, sort_order)
      VALUES (
        'lead-publi', 'Lead Publi', '#a855f7',
        'Vino de un anuncio de Meta y ya recibio la respuesta automatica con links de ficha, catalogo y selector.',
        true, 15
      )
      ON CONFLICT (slug) DO NOTHING
    `;

    // contacts tiene: id, display_name, consultype
    // conversations tiene: id, contact_id (sin consultype ni nombre)
    // messages tiene: conversation_id, body, created_at
    const rowsRaw = await sql`
      SELECT DISTINCT ON (ct.id)
        ct.id         AS id,
        ct.display_name AS name,
        ct.consultype
      FROM messages m
      JOIN conversations c  ON c.id  = m.conversation_id
      JOIN contacts     ct ON ct.id = c.contact_id
      WHERE m.created_at >= NOW() - INTERVAL '48 hours'
        AND m.body ILIKE '%Vino de un anuncio de Meta%'
      ORDER BY ct.id
    `;
    const rows = Array.isArray(rowsRaw)
      ? (rowsRaw as Array<{ id: string; name: string; consultype: string }>)
      : [];

    const total = rows.length;
    if (total === 0) {
      return NextResponse.json({
        updated: 0,
        total_candidates: 0,
        message: "Sin conversaciones de publi en las ultimas 48hs.",
      });
    }

    const ids = rows.map((r) => r.id);

    // Actualizar consultype en contacts (ahí vive el estado)
    const updatedRaw = await sql`
      UPDATE contacts
      SET consultype = 'lead-publi', updated_at = NOW()
      WHERE id = ANY(${ids})
        AND (consultype IS NULL OR consultype IN ('saludo','informacion','pasar-presupuesto','otro',''))
      RETURNING id
    `;
    const updated = Array.isArray(updatedRaw)
      ? (updatedRaw as Array<{ id: string }>)
      : [];

    const updatedIds = new Set(updated.map((u) => u.id));

    return NextResponse.json({
      updated: updated.length,
      total_candidates: total,
      skipped: total - updated.length,
      names: rows.filter((r) => updatedIds.has(r.id)).map((r) => r.name),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
