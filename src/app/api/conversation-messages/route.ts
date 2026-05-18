import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getConversationReplyTarget, listConversationMessages, recordManualOutboundMessage } from "@/lib/crm";
import { sendWhatsAppText } from "@/lib/whatsapp";

const schema = z.object({
  conversationId: z.string().uuid()
});

const sendSchema = schema.extend({
  text: z.string().trim().min(1).max(4000)
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = schema.safeParse({
    conversationId: request.nextUrl.searchParams.get("conversationId")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Conversacion invalida." }, { status: 400 });
  }

  return NextResponse.json({
    messages: await listConversationMessages(parsed.data.conversationId)
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje invalido." }, { status: 400 });
  }

  const target = await getConversationReplyTarget(parsed.data.conversationId);

  if (!target) {
    return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
  }

  try {
    await sendWhatsAppText(target.phone, parsed.data.text);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos enviar el WhatsApp." },
      { status: 502 }
    );
  }

  await recordManualOutboundMessage({
    conversationId: parsed.data.conversationId,
    contactId: target.contact_id,
    userId: user.id,
    body: parsed.data.text
  });

  return NextResponse.json({
    ok: true,
    messages: await listConversationMessages(parsed.data.conversationId)
  });
}
