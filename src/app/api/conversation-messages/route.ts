import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getConversationReplyTarget, listConversationMessages, recordManualOutboundMessage, saveMessageMedia } from "@/lib/crm";
import { sendWhatsAppAudio, sendWhatsAppText, uploadWhatsAppMedia } from "@/lib/whatsapp";

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

  const contentType = request.headers.get("content-type") ?? "";
  const parsed = contentType.includes("multipart/form-data")
    ? await parseAudioRequest(request)
    : sendSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje invalido." }, { status: 400 });
  }

  const target = await getConversationReplyTarget(parsed.data.conversationId);

  if (!target) {
    return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
  }

  try {
    if ("audio" in parsed.data) {
      const uploaded = await uploadWhatsAppMedia(parsed.data.audio);
      await sendWhatsAppAudio(target.phone, uploaded.id);
      const messageId = await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: "Audio enviado"
      });
      const buffer = Buffer.from(await parsed.data.audio.arrayBuffer());

      await saveMessageMedia({
        messageId,
        waMediaId: uploaded.id,
        mimeType: parsed.data.audio.type || "audio/mpeg",
        filename: parsed.data.audio.name || "audio",
        fileSize: parsed.data.audio.size,
        dataBase64: buffer.toString("base64")
      });
    } else {
      await sendWhatsAppText(target.phone, parsed.data.text);
      await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: parsed.data.text
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos enviar el WhatsApp." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    messages: await listConversationMessages(parsed.data.conversationId)
  });
}

async function parseAudioRequest(request: NextRequest) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  return z
    .object({
      conversationId: z.string().uuid(),
      audio: z.instanceof(File).refine((file) => file.size > 0 && file.size <= 16 * 1024 * 1024)
    })
    .safeParse({
      conversationId: formData.get("conversationId"),
      audio
    });
}
