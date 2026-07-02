import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { getSql, isDbConfigured } from "@/lib/db";
import { normalizeWhatsAppRecipient, upsertContactConversation } from "@/lib/crm";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { templateForSegment, parseReactivationCsv, buildReactivationPreview, reactivationBodyParameters } from "@/lib/reactivation-campaign";

export const maxDuration = 300;

// TAREA 3 (campaña reactivación jul-2026): motor de envío. Toma el CSV que exporta DEV ADMIN
// (`export-leads-reactivacion.mjs`) y, POR FILA, arma el mensaje según plantilla y lo envía
// (o solo lo previsualiza en dryRun). Rate limit 1 msg/3-5s. Etiqueta `campana-reactivacion-jul26`
// + `seg-a`/`seg-b`/`seg-c`. Excluye contactos con conversación WhatsApp reciente (<45 días).
//
// ⚠️ dryRun=true es el ÚNICO modo expuesto en la UI hoy (02/07). El envío real (dryRun=false)
// requiere admin/token + confirm==="ENVIAR" y NO tiene botón en la UI todavía — se dispara a mano
// (curl/Postman) solo cuando: plantillas aprobadas por Meta + dry-run revisado por Guille +
// prueba con 3 números internos. Ver BITACORA-EJECUCION.md 02/07.
async function authorize(request: NextRequest): Promise<boolean> {
  const token = config.ADMIN_TOOLS_TOKEN;
  const auth = request.headers.get("authorization");
  if (token && auth === `Bearer ${token}`) return true;
  const user = await getCurrentUser();
  return user?.role === "admin";
}

const bodySchema = z.object({
  csv: z.string().min(1),
  segment: z.enum(["a", "b", "c"]),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(50),
  dryRun: z.boolean().default(true),
  confirm: z.string().optional()
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const { csv, segment, offset, limit, dryRun, confirm } = parsed.data;

  if (!dryRun && confirm !== "ENVIAR") {
    return NextResponse.json({ error: 'Envío real requiere confirm:"ENVIAR" explícito.' }, { status: 400 });
  }

  const template = templateForSegment(segment);
  const allRows = parseReactivationCsv(csv);
  const slice = allRows.slice(offset, offset + limit);

  const preview = await buildReactivationPreview(slice, template);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      template: template.name,
      totalEnCsv: allRows.length,
      previstos: preview.length,
      aExcluirPorConversacionPrevia: preview.filter((r) => !r.incluido).length,
      contactos: preview
    });
  }

  // ── ENVÍO REAL (no expuesto en UI todavía) ──
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB no configurada." }, { status: 500 });
  }
  const sql = getSql();
  const results: Array<{ whatsapp: string; ok: boolean; skipped?: string; error?: string }> = [];
  const segLabel = `seg-${segment}`;

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    const pv = preview[i];
    const phone = normalizeWhatsAppRecipient(row.whatsapp);

    if (!pv.incluido) {
      results.push({ whatsapp: phone, ok: false, skipped: "conversacion_previa_reciente" });
      continue;
    }

    try {
      const sent = await sendWhatsAppTemplate({
        to: phone,
        name: template.name,
        languageCode: template.language,
        bodyParameters: reactivationBodyParameters(row)
      });
      const waMessageId = (sent as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? null;

      const target = await upsertContactConversation({ phone, displayName: row.nombre || null });
      // Insert directo (sin created_by): es un envío del sistema, no de un usuario puntual.
      // Mismo patrón que los crons (window24-followup) que registran outbound sin operador humano.
      await sql`
        insert into messages (conversation_id, contact_id, account_id, channel, direction, wa_message_id, external_message_id, body, metadata, created_at)
        values (
          ${target.conversationId}::uuid,
          ${target.contactId}::uuid,
          (select account_id from conversations where id = ${target.conversationId}::uuid),
          (select channel from conversations where id = ${target.conversationId}::uuid),
          'outbound',
          ${waMessageId},
          ${waMessageId},
          ${pv.mensaje},
          ${JSON.stringify({ source: "campana_reactivacion", template: template.name, segmento: segment })}::jsonb,
          now()
        )
      `.catch(() => {});
      await sql`update conversations set last_message_at = now(), updated_at = now() where id = ${target.conversationId}::uuid`.catch(() => {});

      // Tags aditivos (no pisa tags existentes).
      await sql`
        update contacts
        set tags = (select array_agg(distinct t) from unnest(coalesce(tags, '{}') || ${["campana-reactivacion-jul26", segLabel]}::text[]) as t),
            updated_at = now()
        where id = ${target.contactId}
      `.catch(() => {});

      results.push({ whatsapp: phone, ok: true });
    } catch (e) {
      results.push({ whatsapp: phone, ok: false, error: e instanceof Error ? e.message : "error" });
    }

    if (i < slice.length - 1) {
      await sleep(3000 + Math.random() * 2000); // 3-5s entre envíos
    }
  }

  const enviados = results.filter((r) => r.ok).length;
  const saltados = results.filter((r) => r.skipped).length;
  const fallidos = results.filter((r) => !r.ok && !r.skipped).length;

  return NextResponse.json({ ok: true, dryRun: false, template: template.name, enviados, saltados, fallidos, results });
}
