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
    // 1. Asegurar que la etiqueta lead-publi existe
    await sql`
      INSERT INTO label_definitions (slug, name, color, instructions, active, sort_order)
      VALUES (
        'lead-publi', 'Lead Publi', '#a855f7',
        'Vino de un anuncio de Meta (Click-to-WhatsApp) y ya recibio la respuesta automatica con el link de la ficha del producto, el catalogo y el selector. Todavia no cotizo ni dio datos tecnicos. Es un lead de publicidad en etapa inicial de contacto.',
        true, 15
      )
      ON CONFLICT (slug) DO UPDATE
        SET name = excluded.name,
            color = excluded.color,
            active = true,
            updated_at = now()
    `;

    // 2. Crear template de seguimiento para publi leads
    // Nombre del template en Meta: febecos_seguimiento_publi
    // Debe estar aprobado en Meta Business Manager para enviarse fuera de la ventana de 24hs
    const templateRowsRaw = await sql`
      INSERT INTO message_templates (label, name, language_code, category, body, active)
      VALUES (
        'Seguimiento Lead Publi',
        'febecos_seguimiento_publi',
        'es_AR',
        'session',
        'Hola! 👋 Te escribimos desde Febecos. ¿Pudiste ver los datos del equipo que te compartimos? Si tenés alguna duda o querés que un asesor te ayude a elegir la bomba solar ideal para tu campo, estamos por acá. 😊',
        true
      )
      ON CONFLICT (name, language_code) DO UPDATE
        SET label = excluded.label,
            body = excluded.body,
            active = true,
            updated_at = now()
      RETURNING id::text, label, name
    `;
    const templateRows = Array.isArray(templateRowsRaw)
      ? (templateRowsRaw as Array<{ id: string; label: string; name: string }>)
      : [];
    const template = templateRows[0];

    if (!template) {
      return NextResponse.json({ error: "No se pudo crear el template." }, { status: 500 });
    }

    // 3. Crear regla de automatización: lead-publi → 21 hs → enviar seguimiento
    const ruleRowsRaw = await sql`
      INSERT INTO template_automation_rules (
        name, consultype, template_id, delay_amount, delay_unit,
        body_parameters, active
      )
      VALUES (
        'Seguimiento Lead Publi 21hs',
        'lead-publi',
        ${template.id}::uuid,
        21,
        'hours',
        '[]'::jsonb,
        true
      )
      ON CONFLICT DO NOTHING
      RETURNING id::text, name, consultype, delay_amount, delay_unit
    `;
    const ruleRows = Array.isArray(ruleRowsRaw)
      ? (ruleRowsRaw as Array<{ id: string; name: string; consultype: string; delay_amount: number; delay_unit: string }>)
      : [];

    // Si ya existía (DO NOTHING), buscarla
    const existingRuleRaw = ruleRows.length === 0 ? await sql`
      SELECT id::text, name, consultype, delay_amount, delay_unit
      FROM template_automation_rules
      WHERE consultype = 'lead-publi' AND active = true
      LIMIT 1
    ` : null;
    const rule = ruleRows[0] ?? (Array.isArray(existingRuleRaw) ? existingRuleRaw[0] : null);

    return NextResponse.json({
      ok: true,
      label: "lead-publi creada/actualizada",
      template: { id: template.id, name: template.name, label: template.label },
      rule: rule ?? "ya existia",
      nota: "✅ Se envia como mensaje de texto libre (category=session), dentro de la ventana de 24hs. No requiere aprobacion de Meta.",
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
