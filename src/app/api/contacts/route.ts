import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getMessageTemplate,
  listConversationMessages,
  listConversations,
  recordManualOutboundMessage,
  upsertContactConversation
} from "@/lib/crm";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

const createContactSchema = z.object({
  phone: z.string().trim().min(6).max(30),
  displayName: z.string().trim().max(120).optional(),
  templateId: z.string().uuid().optional(),
  parameters: z.array(z.string().trim().max(200)).optional()
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = createContactSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de contacto invalidos." }, { status: 400 });
  }

  const target = await upsertContactConversation({
    phone: parsed.data.phone,
    displayName: parsed.data.displayName,
    userId: user.id
  });

  if (parsed.data.templateId) {
    const template = await getMessageTemplate(parsed.data.templateId);

    if (!template || !template.active) {
      return NextResponse.json({ error: "Plantilla no encontrada o inactiva." }, { status: 404 });
    }

    try {
      const sent = await sendWhatsAppTemplate({
        to: target.phone,
        name: template.name,
        languageCode: template.language_code,
        bodyParameters: parsed.data.parameters
      });

      await recordManualOutboundMessage({
        conversationId: target.conversationId,
        contactId: target.contactId,
        userId: user.id,
        body: `Plantilla: ${template.label}`,
        waMessageId: getSentMessageId(sent),
        metadata: {
          whatsapp_template_id: template.id,
          whatsapp_template_name: template.name,
          whatsapp_template_language: template.language_code
        }
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No pudimos enviar la plantilla." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    conversationId: target.conversationId,
    conversations: await listConversations({ limit: 300 }),
    messages: await listConversationMessages(target.conversationId)
  });
}

function getSentMessageId(response: unknown) {
  const data = response as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}
