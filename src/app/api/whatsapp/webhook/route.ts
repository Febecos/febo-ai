import { NextRequest, NextResponse } from "next/server";
import { runFebecosAgent } from "@/lib/agent";
import { config } from "@/lib/config";
import { recordAgentReply, recordIncomingMessage, saveMessageMedia } from "@/lib/crm";
import {
  downloadWhatsAppMedia,
  extractInboundMessages,
  isWhatsAppAudioMessage,
  isWhatsAppTextMessage,
  sendWhatsAppText,
  verifyMetaSignature
} from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const mode = search.get("hub.mode");
  const token = search.get("hub.verify_token");
  const challenge = search.get("hub.challenge");

  if (mode === "subscribe" && token && token === config.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Webhook no autorizado." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma invalida." }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const messages = extractInboundMessages(body);

  for (const message of messages) {
    const stored = await recordIncomingMessage({
      phone: message.from,
      waMessageId: message.id,
      text: isWhatsAppTextMessage(message) ? message.text : "Audio recibido",
      contactName: message.contactName
    });

    if (isWhatsAppAudioMessage(message) && stored.messageId) {
      const media = await downloadWhatsAppMedia(message.mediaId);

      await saveMessageMedia({
        messageId: stored.messageId,
        waMediaId: media.waMediaId,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        sha256: media.sha256 ?? message.sha256,
        dataBase64: media.dataBase64
      });
    }

    if (!stored.aiEnabled) {
      continue;
    }

    if (!isWhatsAppTextMessage(message)) {
      continue;
    }

    const result = await runFebecosAgent({
      phone: message.from,
      message: message.text,
      contactName: message.contactName
    });

    await sendWhatsAppText(message.from, result.respuesta);

    await recordAgentReply({
      contactId: stored.contactId,
      threadId: stored.threadId,
      answer: result.respuesta,
      intent: result.consultype,
      needsHuman: result.escalar
    });
  }

  return NextResponse.json({ ok: true });
}
