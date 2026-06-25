import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getMessageTemplate,
  listContacts,
  listConversationMessages,
  listConversations,
  recordManualOutboundMessage,
  scheduleTemplateMessage,
  updateContact,
  upsertContactConversation
} from "@/lib/crm";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

const createContactSchema = z.object({
  phone: z.string().trim().min(6).max(30),
  displayName: z.string().trim().max(120).optional(),
  templateId: z.string().uuid().optional(),
  parameters: z.array(z.string().trim().max(200)).optional(),
  scheduledAt: z.string().datetime().optional()
});

const updateContactSchema = z.object({
  contactId: z.string().uuid(),
  displayName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  cuit: z.string().trim().max(20).nullable().optional(),
  tags: z.array(z.string().trim().max(60)).max(20).optional(),
  contactType: z.string().trim().max(40).optional(),
  sentiment: z.string().trim().max(40).optional(),
  consultype: z.string().trim().max(40).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  contactInfo: z.object({
    notes: z.string().max(3000).optional(),
    additional: z.array(z.object({
      id: z.string().max(80).optional(),
      title: z.string().max(80).optional(),
      value: z.string().max(400).optional()
    })).max(20).optional()
  }).optional(),
  afipData: z.object({
    razonSocial: z.string().max(200).optional(),
    domicilio: z.string().max(200).optional(),
    codigoPostal: z.string().max(20).optional(),
    localidad: z.string().max(100).optional(),
    provincia: z.string().max(100).optional()
  }).nullable().optional()
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams;

  return NextResponse.json({
    contacts: await listContacts({
      query: search.get("q") ?? undefined,
      limit: Number(search.get("limit") ?? 300)
    })
  });
}

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

    if (parsed.data.scheduledAt) {
      const scheduledAt = new Date(parsed.data.scheduledAt);

      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Elegí una fecha y hora futura para programar la plantilla." }, { status: 400 });
      }

      await scheduleTemplateMessage({
        conversationId: target.conversationId,
        contactId: target.contactId,
        templateId: template.id,
        phone: target.phone,
        bodyParameters: parsed.data.parameters,
        scheduledAt,
        timezone: "America/Argentina/Buenos_Aires",
        createdBy: user.id
      });

      return NextResponse.json({
        ok: true,
        scheduled: true,
        contactId: target.contactId,
        conversationId: target.conversationId,
        contacts: await listContacts({ limit: 300 }),
        conversations: await listConversations({ limit: 300 }),
        messages: await listConversationMessages(target.conversationId)
      });
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
    contactId: target.contactId,
    conversationId: target.conversationId,
    contacts: await listContacts({ limit: 300 }),
    conversations: await listConversations({ limit: 300 }),
    messages: await listConversationMessages(target.conversationId)
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = updateContactSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de contacto invalidos." }, { status: 400 });
  }

  try {
    const result = await updateContact(parsed.data);

    if (!result) {
      return NextResponse.json({ error: "Contacto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      contacts: await listContacts({ limit: 300 }),
      conversations: await listConversations({ limit: 300 })
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("duplicate") ?
      "Ya existe otro contacto con ese WhatsApp." :
      "No pudimos guardar el contacto.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function getSentMessageId(response: unknown) {
  const data = response as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}
