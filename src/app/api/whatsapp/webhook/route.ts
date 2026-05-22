import { after, NextRequest, NextResponse } from "next/server";
import { runFebecosAgent, transcribeAudio } from "@/lib/agent";
import { config } from "@/lib/config";
import { recordAgentReply, recordIncomingMessage, recordWhatsAppMessageStatuses, saveMessageMedia, updateMessageBody } from "@/lib/crm";
import { sendPushNotificationToAll } from "@/lib/push";
import {
  downloadWhatsAppMedia,
  extractInboundMessages,
  extractMessageStatuses,
  isWhatsAppAudioMessage,
  isWhatsAppMediaMessage,
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
const DEFAULT_AUTO_REPLY_DELAY_SECONDS = 90;

export const maxDuration = 150;

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
    const initialBody = isText ? agentMessage : getInboundMediaBody(message);

    const stored = await recordIncomingMessage({
      phone: message.from,
      waMessageId: message.id,
      text: initialBody,
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

    if (isWhatsAppMediaMessage(message) && stored.messageId) {
      try {
        const media = await downloadWhatsAppMedia(message.mediaId);

        await saveMessageMedia({
          messageId: stored.messageId,
          waMediaId: media.waMediaId,
          mimeType: media.mimeType,
          filename: message.filename ?? inboundMediaFilename(message.type, media.mimeType),
          fileSize: media.fileSize,
          sha256: media.sha256 ?? message.sha256,
          dataBase64: media.dataBase64
        });

        agentMessage = getInboundMediaBody(message);
      } catch (error) {
        console.error("No pudimos procesar archivo de WhatsApp.", error);
        await updateMessageBody(stored.messageId, `${getInboundMediaLabel(message)} recibido (no pudimos descargarlo).`);
      }
    }

    if (!stored.aiEnabled) {
      continue;
    }

    scheduleAutomaticReply({
      message,
      interactiveId: isText ? message.interactiveId : undefined,
      agentMessage,
      stored
    });
  }

  return NextResponse.json({ ok: true });
}

function getInboundMediaBody(message: InboundWhatsAppMessage) {
  if (isWhatsAppTextMessage(message)) {
    return message.text;
  }

  if (isWhatsAppAudioMessage(message)) {
    return "Audio recibido";
  }

  const label = getInboundMediaLabel(message);
  return message.caption ? `${label} recibido: ${message.caption}` : `${label} recibido`;
}

function getInboundMediaLabel(message: InboundWhatsAppMessage) {
  if (!isWhatsAppMediaMessage(message)) {
    return "Archivo";
  }

  if (message.type === "image") {
    return "Imagen";
  }

  if (message.type === "video") {
    return "Video";
  }

  return "Documento";
}

function inboundMediaFilename(type: "image" | "video" | "document", mimeType: string) {
  const extension = extensionForMime(mimeType, type);
  return `whatsapp-${type}-${Date.now()}.${extension}`;
}

function extensionForMime(mimeType: string, fallbackType: "image" | "video" | "document") {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }

  if (normalized.includes("png")) {
    return "png";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  if (normalized.includes("mp4")) {
    return "mp4";
  }

  if (normalized.includes("3gpp") || normalized.includes("3gp")) {
    return "3gp";
  }

  if (normalized.includes("pdf")) {
    return "pdf";
  }

  return fallbackType === "image" ? "jpg" : fallbackType === "video" ? "mp4" : "bin";
}

type InboundWhatsAppMessage = ReturnType<typeof extractInboundMessages>[number];
type StoredIncomingMessage = Awaited<ReturnType<typeof recordIncomingMessage>>;

function scheduleAutomaticReply(input: {
  message: InboundWhatsAppMessage;
  interactiveId?: string;
  agentMessage: string;
  stored: StoredIncomingMessage;
}) {
  after(async () => {
    try {
      await waitBeforeAutomaticReply();
      await sendAutomaticReply(input);
    } catch (error) {
      console.error("No pudimos completar la respuesta automatica diferida.", error);
    }
  });
}

async function sendAutomaticReply(input: {
  message: InboundWhatsAppMessage;
  interactiveId?: string;
  agentMessage: string;
  stored: StoredIncomingMessage;
}) {
  const { message, interactiveId, agentMessage, stored } = input;

  if (interactiveId === WHATSAPP_BUTTON_TALK_TO_ADVISOR) {
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

    return;
  }

  if (interactiveId === WHATSAPP_BUTTON_KEEP_ASSISTING) {
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

    return;
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

    return;
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

  const advisorDecisionButtons = getAdvisorDecisionButtons(result.respuesta, result.escalar);
  const needsHuman = advisorDecisionButtons ? false : shouldPauseForHumanHandoff(result.respuesta, result.escalar);

  const paymentButtons = getPaymentDecisionButtons(result.respuesta, needsHuman);
  let sentReplyOptions: Array<{ id: string; title: string }> | undefined;

  try {
    const sent = paymentButtons ?
      (
        sentReplyOptions = paymentButtons,
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: paymentButtons
        })
      )
    : advisorDecisionButtons ?
      (
        sentReplyOptions = advisorDecisionButtons,
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: advisorDecisionButtons
        })
      )
    : shouldOfferAdvisorButton(result.respuesta, needsHuman) ?
      (
        sentReplyOptions = [
          { id: WHATSAPP_BUTTON_TALK_TO_ADVISOR, title: "Hablar asesor" }
        ],
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: sentReplyOptions
        })
      )
    : shouldOfferDecisionButtons(result.respuesta, needsHuman) ?
      (
        sentReplyOptions = [
          { id: WHATSAPP_BUTTON_VIEW_INSTALLMENTS, title: "Ver cuotas" },
          { id: WHATSAPP_BUTTON_TALK_TO_ADVISOR, title: "Hablar asesor" }
        ],
        await sendWhatsAppReplyButtons({
          to: message.from,
          body: result.respuesta,
          buttons: sentReplyOptions
        })
      )
    : await sendWhatsAppText(message.from, result.respuesta);

    await recordAgentReply({
      contactId: stored.contactId,
      threadId: stored.threadId,
      answer: result.respuesta,
      intent: result.consultype,
      needsHuman,
      waMessageId: getSentMessageId(sent),
      replyOptions: sentReplyOptions
    });
  } catch (error) {
    console.error("No pudimos enviar o registrar la respuesta automatica.", error);
  }
}

async function waitBeforeAutomaticReply() {
  const delaySeconds = Number(process.env.FEBO_AUTO_REPLY_DELAY_SECONDS ?? DEFAULT_AUTO_REPLY_DELAY_SECONDS);
  const safeDelaySeconds = Number.isFinite(delaySeconds) && delaySeconds >= 0 ? delaySeconds : DEFAULT_AUTO_REPLY_DELAY_SECONDS;
  await sleep(safeDelaySeconds * 1000);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function getAdvisorDecisionButtons(answer: string, escalates = false) {
  const normalized = normalizeAnswer(answer);

  if (!normalized.includes("asesor")) {
    return null;
  }

  if (!isConditionalAdvisorOffer(normalized) && !escalates) {
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
  const normalized = normalizeAnswer(answer);

  if (normalized.includes("asesor") && isConditionalAdvisorOffer(normalized)) {
    return false;
  }

  if (escalates) {
    return true;
  }

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

function isConditionalAdvisorOffer(normalizedAnswer: string) {
  return [
    "si queres",
    "si quieres",
    "queres que",
    "quieres que",
    "podes hablar",
    "puedes hablar",
    "te ayudo a coordinar",
    "te puedo pasar",
    "podemos pasarte"
  ].some((phrase) => normalizedAnswer.includes(phrase));
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
