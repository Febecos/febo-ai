import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

// Endpoint de uso único: aplica etiqueta 'lead-publi' a conversaciones de hoy
// que recibieron respuesta de publi (tienen bloque [Vino de un anuncio de Meta]).
export async function GET() { return handler(); }
export async function POST() { return handler(); }
async function handler() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Solo administrador." }, { status: 403 });
  }

  const sql = getSql();

  // 1. Asegurarse que la etiqueta lead-publi existe
  await sql`
    INSERT INTO label_definitions (slug, name, color, instructions, active, sort_order)
    VALUES (
      'lead-publi',
      'Lead Publi',
      '#a855f7',
      'Vino de un anuncio de Meta (Click-to-WhatsApp) y ya recibio la respuesta automatica con el link de la ficha del producto, el catalogo y el selector. Todavia no cotizo ni dio datos tecnicos.',
      true,
      15
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      color = EXCLUDED.color,
      instructions = EXCLUDED.instructions,
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order
  `;

  // 2. Encontrar conversaciones con mensajes que tienen bloque de publi de Meta
  const candidates = await sql`
    SELECT DISTINCT m.conversation_id, c.consultype, c.contact_name
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.created_at >= NOW() - INTERVAL '48 hours'
      AND m.body ILIKE '%Vino de un anuncio de Meta%'
    ORDER BY m.conversation_id
  ` as Array<{ conversation_id: string; consultype: string; contact_name: string }>;

  if (!candidates.length) {
    return NextResponse.json({ updated: 0, conversations: [] });
  }

  const ids = candidates.map((r) => r.conversation_id);

  // 3. Actualizar a lead-publi solo las que NO están en un estado más avanzado
  const updated = await sql`
    UPDATE conversations
    SET consultype = 'lead-publi',
        updated_at = NOW()
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
