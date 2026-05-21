import { NextRequest, NextResponse } from "next/server";
import { runFebecosAgent, transcribeAudio } from "@/lib/agent";
import { config } from "@/lib/config";
import { recordAgentReply, recordIncomingMessage, recordWhatsAppMessageStatuses, saveMessageMedia, updateMessageBody } from "@/lib/crm";
import { sendPushNotificationToAll } from "@/lib/push";
import {
  downloadWhatsAppMedia,
  extractInboundMessages,
  extractMessageStatuses,
  isWhatsAppAudioMessage,
  isWhatsAppTextMessage,
  sendWhatsAppReplyButtons,
  sendWhatsAppText,
  verifyMetaSignature
} from "@/lib/whatsapp";

const WHATSAPP_BUTTON_VIEW_INSTALLMENTS = "febo_view_installments";
const WHATSAPP_BUTTON_TALK_TO_ADVISOR = "febo_talk_to_advisor";
const WHATSAPP_BUTTON_KEEP_ASSISTING = "febo_keep_assisting";
const WHATSAPP_BUTTON_SIX_INSTALLMENTS = "febo_six_installments";
const WHATSAPP_BUTTON_CASH = "febo_cash";

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
  const statuses = extractMessageStatuses(body);
  const messages = extractInboundMessages(body);

  await recordWhatsAppMessageStatuses(statuses);

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

    await notifyNewInboundMessage({
      title: message.contactName ? `Nueva consulta de ${message.contactName}` : "Nueva consulta en Febo AI",
      body: agentMessage || "Mensaje nuevo recibido por WhatsApp."
    });

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

    if (isText && message.interactiveId === WHATSAPP_BUTTON_TALK_TO_ADVISOR) {
      const handoffAnswer = "Perfecto. Te paso con un asesor de Febecos para que lo vean directo y coordinen como seguir.";
      const sent = await sendWhatsAppText(message.from, handoffAnswer);

      await recordAgentReply({
        contactId: stored.contactId,
        threadId: stored.threadId,
        answer: handoffAnswer,
        intent: "caliente",
        needsHuman: true,
        waMessageId: getSentMessageId(sent)
      });

      continue;
    }

    if (isText && message.interactiveId === WHATSAPP_BUTTON_KEEP_ASSISTING) {
      const keepAssistingAnswer = "Perfecto, seguimos por aca. Decime que queres revisar: equipo, precio, cuotas, instalacion, envio o cualquier duda tecnica.";
      const sent = await sendWhatsAppText(message.from, keepAssistingAnswer);

      await recordAgentReply({
        contactId: stored.contactId,
        threadId: stored.threadId,
        answer: keepAssistingAnswer,
        intent: "otro",
        needsHuman: false,
        waMessageId: getSentMessageId(sent)
      });

      continue;
    }

    if (!agentMessage) {
      const fallbackAnswer = "Recibi tu audio, pero no pude leerlo bien. Me lo podes mandar por escrito?";

      const sent = await sendWhatsAppText(message.from, fallbackAnswer);

      await recordAgentReply({
        contactId: stored.contactId,
        threadId: stored.threadId,
        answer: fallbackAnswer,
        intent: "otro",
        needsHuman: false,
        waMessageId: getSentMessageId(sent)
      });

      continue;
    }

    let result;
    try {
      result = await runFebecosAgent({
        phone: message.from,
        message: agentMessage,
        contactName: message.contactName,
        conversationId: stored.threadId
      });
    } catch (error) {
      console.error("No pudimos generar respuesta automatica.", error);
      result = buildAgentFallbackResult();
    }

    const advisorDecisionButtons = getAdvisorDecisionButtons(result.respuesta);
    const needsHuman = advisorDecisionButtons ? false : shouldPauseForHumanHandoff(result.respuesta, result.escalar);

    const paymentButtons = getPaymentDecisionButtons(result.respuesta, needsHuman);
    try {
      const sent = paymentButtons ?
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: paymentButtons
        })
      : advisorDecisionButtons ?
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: advisorDecisionButtons
        })
      : shouldOfferAdvisorButton(result.respuesta, needsHuman) ?
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: [
            { id: WHATSAPP_BUTTON_TALK_TO_ADVISOR, title: "Hablar asesor" }
          ]
        })
      : shouldOfferDecisionButtons(result.respuesta, needsHuman) ?
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: [
            { id: WHATSAPP_BUTTON_VIEW_INSTALLMENTS, title: "Ver cuotas" },
            { id: WHATSAPP_BUTTON_TALK_TO_ADVISOR, title: "Hablar asesor" }
          ]
        })
      : await sendWhatsAppText(message.from, result.respuesta);

      await recordAgentReply({
        contactId: stored.contactId,
        threadId: stored.threadId,
        answer: result.respuesta,
        intent: result.consultype,
        needsHuman,
        waMessageId: getSentMessageId(sent)
      });
    } catch (error) {
      console.error("No pudimos enviar o registrar la respuesta automatica.", error);
    }
  }

  return NextResponse.json({ ok: true });
}

async function notifyNewInboundMessage(input: { title: string; body: string }) {
  try {
    await sendPushNotificationToAll({
      title: input.title,
      body: input.body,
      url: "/"
    });
  } catch (error) {
    console.error("No pudimos enviar la notificacion del mensaje entrante.", error);
  }
}

function buildAgentFallbackResult() {
  return {
    respuesta: "Recibimos tu consulta. Te paso con un asesor de Febecos para que lo revise y te responda bien.",
    sentimiento: "neutral" as const,
    consultype: "caliente",
    escalar: true,
    nombre: null,
    imagenes: [],
    archivos: [],
    action: "create_ticket" as const,
    actionSubject: "fallback por error de respuesta automatica"
  };
}

function getPaymentDecisionButtons(answer: string, needsHuman: boolean) {
  if (needsHuman) {
    return null;
  }

  const normalized = normalizeAnswer(answer);

  if (
    normalized.includes("cuota") &&
    normalized.includes("contado") &&
    (
      normalized.includes("queres verlo") ||
      normalized.includes("pensando mas de contado") ||
      normalized.includes("preferis")
    )
  ) {
    return [
      { id: WHATSAPP_BUTTON_SIX_INSTALLMENTS, title: "6 cuotas" },
      { id: WHATSAPP_BUTTON_CASH, title: "Contado" },
      { id: WHATSAPP_BUTTON_TALK_TO_ADVISOR, title: "Hablar asesor" }
    ];
  }

  return null;
}

function getAdvisorDecisionButtons(answer: string) {
  const normalized = normalizeAnswer(answer);

  if (!normalized.includes("asesor")) {
    return null;
  }

  const isOffer =
    normalized.includes("si queres") ||
    normalized.includes("queres que") ||
    normalized.includes("podes hablar") ||
    normalized.includes("te ayudo a coordinar") ||
    normalized.includes("te puedo pasar");

  if (!isOffer) {
    return null;
  }

  return [
    { id: WHATSAPP_BUTTON_TALK_TO_ADVISOR, title: "Si, asesor" },
    { id: WHATSAPP_BUTTON_KEEP_ASSISTING, title: "No, seguir" }
  ];
}

function shouldOfferAdvisorButton(answer: string, needsHuman: boolean) {
  if (needsHuman) {
    return false;
  }

  const normalized = normalizeAnswer(answer);

  return normalized.includes("hablar con un asesor") || normalized.includes("hablar con asesor");
}

function shouldOfferDecisionButtons(answer: string, needsHuman: boolean) {
  if (needsHuman) {
    return false;
  }

  const normalized = normalizeAnswer(answer);

  return (
    normalized.includes("cuota") &&
    normalized.includes("asesor") &&
    (
      normalized.includes("como te gustaria") ||
      normalized.includes("queres verlo") ||
      normalized.includes("preferis verlo")
    )
  );
}

function normalizeAnswer(answer: string) {
  return answer
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSentMessageId(response: unknown) {
  const data = response as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}

function shouldPauseForHumanHandoff(answer: string, escalates: boolean) {
  if (escalates) {
    return true;
  }

  const normalized = answer
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return [
    "te paso a un asesor",
    "te paso con un asesor",
    "te paso a un vendedor",
    "te paso con un vendedor",
    "te paso con el equipo",
    "ya lo estamos derivando",
    "te van a estar escribiendo"
  ].some((phrase) => normalized.includes(phrase));
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
