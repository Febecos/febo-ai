import { NextRequest, NextResponse } from "next/server";
import {
  listConversationMessages,
  listDueScheduledTemplateMessages,
  markScheduledTemplateMessageFailed,
  markScheduledTemplateMessageSent,
  recordManualOutboundMessage
} from "@/lib/crm";
import { config } from "@/lib/config";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const due = await listDueScheduledTemplateMessages(20);
  const results: Array<{ id: string; ok: boolean; error?: string; mode?: string }> = [];

  for (const item of due) {
    if (!item.created_by) {
      const error = "El usuario que programo la plantilla ya no existe.";
      await markScheduledTemplateMessageFailed({ id: item.id, error });
      results.push({ id: item.id, ok: false, error });
      continue;
    }

    try {
      // Si el template es tipo 'session', mandamos texto libre (ventana 24hs)
      // No necesita aprobación de Meta — válido cuando se envía dentro de las 24hs del último mensaje del cliente
      const isSessionMessage = item.template_category === "session";

      let waMessageId: string | null = null;
      let bodyText: string;

      if (isSessionMessage && item.template_body) {
        const sent = await sendWhatsAppText(item.phone, item.template_body);
        waMessageId = getSentMessageId(sent);
        bodyText = item.template_body;
      } else {
        const sent = await sendWhatsAppTemplate({
          to: item.phone,
          name: item.template_name,
          languageCode: item.template_language_code,
          bodyParameters: item.body_parameters
        });
        waMessageId = getSentMessageId(sent);
        bodyText = `Plantilla programada: ${item.template_label}`;
      }

      await recordManualOutboundMessage({
        conversationId: item.conversation_id,
        contactId: item.contact_id,
        userId: item.created_by,
        body: bodyText,
        waMessageId,
        metadata: {
          scheduled_template_id: item.id,
          scheduled_at: item.scheduled_at,
          source: isSessionMessage ? "session-followup" : "scheduled-template",
          whatsapp_template_id: item.template_id,
          whatsapp_template_name: item.template_name,
          whatsapp_template_language: item.template_language_code
        }
      });
      await markScheduledTemplateMessageSent({ id: item.id, waMessageId });
      results.push({ id: item.id, ok: true, mode: isSessionMessage ? "session-text" : "template" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No pudimos enviar el mensaje programado.";
      await markScheduledTemplateMessageFailed({ id: item.id, error: message });
      results.push({ id: item.id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    results,
    messages: due[0] ? await listConversationMessages(due[0].conversation_id) : undefined
  });
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
