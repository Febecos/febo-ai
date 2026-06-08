import { NextRequest, NextResponse } from "next/server";
import { getSql, isDbConfigured } from "@/lib/db";
import { getSettingValue } from "@/lib/crm";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { config } from "@/lib/config";

export const maxDuration = 60;

const SETTING_KEY = "window24_followup";
const DEFAULT_CONFIG = {
  delayHours: 21,
  text: "Hola! 👋 Te escribimos desde Febecos. ¿Pudiste ver los datos del equipo que te compartimos? Si tenés alguna duda o querés que un asesor te ayude a elegir la bomba solar ideal para tu campo, estamos por acá. 😊",
  enabled: true,
  consultype: "lead-publi"
};

// Marcamos en metadata que ya enviamos el seguimiento 24hs para no reenviar
const ALREADY_SENT_MARKER = "window24_followup_sent";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "DB no configurada." });
  }

  const followupConfig = await getSettingValue(SETTING_KEY, DEFAULT_CONFIG);

  if (!followupConfig.enabled) {
    return NextResponse.json({ ok: true, skipped: "Seguimiento 24hs desactivado." });
  }

  const { delayHours, text, consultype } = followupConfig;
  const sql = getSql();

  // Buscar conversaciones:
  // - con la etiqueta configurada (lead-publi por defecto)
  // - cuyo último mensaje es OUTBOUND (el cliente no respondió)
  // - ese último mensaje tiene >= delayHours horas de antigüedad
  // - pero < 24hs (dentro de la ventana de sesión de WhatsApp)
  // - que no tengan ya el marcador de seguimiento enviado
  const candidates = await sql`
    SELECT DISTINCT ON (c.id)
      c.id              AS conversation_id,
      ct.id             AS contact_id,
      ct.phone,
      m.id              AS last_message_id,
      m.created_at      AS last_message_at,
      m.direction       AS last_direction
    FROM conversations c
    JOIN contacts ct ON ct.id = c.contact_id
    JOIN messages m ON m.conversation_id = c.id
    WHERE ct.consultype = ${consultype}
      AND c.status NOT IN ('closed', 'lost', 'blocked', 'deleted')
      AND ct.phone IS NOT NULL
    ORDER BY c.id, m.created_at DESC
  ` as Array<{
    conversation_id: string;
    contact_id: string;
    phone: string;
    last_message_id: string;
    last_message_at: string;
    last_direction: string;
  }>;

  const results: Array<{ phone: string; ok: boolean; reason?: string }> = [];

  for (const row of candidates) {
    // Solo si el último mensaje fue OUTBOUND (el cliente no respondió aún)
    if (row.last_direction !== "outbound") {
      results.push({ phone: row.phone, ok: false, reason: "ultimo-mensaje-es-inbound" });
      continue;
    }

    const lastAt = new Date(row.last_message_at).getTime();
    const now = Date.now();
    const hoursAgo = (now - lastAt) / 1000 / 3600;

    // Verificar ventana: entre delayHours y 24hs
    if (hoursAgo < delayHours) {
      results.push({ phone: row.phone, ok: false, reason: `faltan-horas (${hoursAgo.toFixed(1)}h)` });
      continue;
    }
    if (hoursAgo >= 24) {
      results.push({ phone: row.phone, ok: false, reason: "fuera-ventana-24hs" });
      continue;
    }

    // Verificar que no hayamos enviado ya el seguimiento en esta conversación
    const alreadySentRows = await sql`
      SELECT id FROM messages
      WHERE conversation_id = ${row.conversation_id}
        AND direction = 'outbound'
        AND metadata->>'source' = 'window24-followup'
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    ` as Array<{ id: string }>;

    if (alreadySentRows.length > 0) {
      results.push({ phone: row.phone, ok: false, reason: "ya-enviado" });
      continue;
    }

    try {
      const sent = await sendWhatsAppText(row.phone, text);
      const waMessageId = getSentMessageId(sent);

      // Insertar el mensaje directamente (el cron no tiene userId)
      await sql`
        INSERT INTO messages (
          conversation_id, contact_id, direction, body,
          wa_message_id, metadata, created_at
        ) VALUES (
          ${row.conversation_id}::uuid,
          ${row.contact_id}::uuid,
          'outbound',
          ${text},
          ${waMessageId},
          ${JSON.stringify({
            source: "window24-followup",
            whatsapp_status: waMessageId ? "accepted" : null,
            hours_elapsed: hoursAgo.toFixed(1)
          })}::jsonb,
          now()
        )
      `;

      // Actualizar last_message_at de la conversación
      await sql`
        UPDATE conversations SET last_message_at = now(), updated_at = now()
        WHERE id = ${row.conversation_id}::uuid
      `;

      results.push({ phone: row.phone, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ phone: row.phone, ok: false, reason: msg });
    }
  }

  const sent = results.filter(r => r.ok).length;
  return NextResponse.json({ ok: true, evaluated: candidates.length, sent, results });
}

function isAuthorizedCronRequest(request: NextRequest) {
  if (!config.CRON_SECRET) {
    return process.env.VERCEL_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${config.CRON_SECRET}`;
}

function getSentMessageId(response: unknown) {
  const data = response as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}
