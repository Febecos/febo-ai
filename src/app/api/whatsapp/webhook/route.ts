import { NextRequest, NextResponse } from "next/server";
import { runFebecosAgent, transcribeAudio } from "@/lib/agent";
import { config } from "@/lib/config";
import { recordAgentReply, recordIncomingMessage, saveMessageMedia, updateMessageBody } from "@/lib/crm";
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
    const isText = isWhatsAppTextMessage(message);
    let agentMessage = isText ? message.text : "";

    const stored = await recordIncomingMessage({
      phone: message.from,
      waMessageId: message.id,
      text: agentMessage || "Audio recibido",
      contactName: message.contactName
    });

    if (stored.duplicate) {
      continue;
    }

    if (isWhatsAppAudioMessage(message) && stored.messageId) {
      try {
        const media = await downloadWhatsAppMedia(message.mediaId);

        await saveMessageMedia({
          messageId: stored.messageId,
          waMediaId: media.waMediaId,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          sha256: media.sha256 ?? message.sha256,
          dataBase64: media.dataBase64
        });

        const transcript = await transcribeAudio({
          dataBase64: media.dataBase64,
          mimeType: media.mimeType,
          filename: `whatsapp-audio-${stored.messageId}.${audioExtensionForMime(media.mimeType)}`
        });

        if (transcript) {
          agentMessage = `Audio transcripto: ${transcript}`;
          await updateMessageBody(stored.messageId, agentMessage);
        }
      } catch (error) {
        console.error("No pudimos procesar audio de WhatsApp.", error);
        await updateMessageBody(stored.messageId, "Audio recibido (no pudimos transcribirlo).");
      }
    }

    if (!stored.aiEnabled) {
      continue;
    }

    if (!agentMessage) {
      const fallbackAnswer = "Recibi tu audio, pero no pude leerlo bien. Me lo podes mandar por escrito?";

      await sendWhatsAppText(message.from, fallbackAnswer);

      await recordAgentReply({
        contactId: stored.contactId,
        threadId: stored.threadId,
        answer: fallbackAnswer,
        intent: "otro",
        needsHuman: false
      });

      continue;
    }

    const result = await runFebecosAgent({
      phone: message.from,
      message: agentMessage,
      contactName: message.contactName,
      conversationId: stored.threadId
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

function audioExtensionForMime(mimeType: string) {
  if (mimeType.includes("mpeg")) {
    return "mp3";
  }

  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  if (mimeType.includes("webm")) {
    return "webm";
  }

  return "ogg";
}
