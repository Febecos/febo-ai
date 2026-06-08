import { after, NextRequest, NextResponse } from "next/server";
import { refreshConversationMemory, runFebecosAgent, transcribeAudio } from "@/lib/agent";
import { config } from "@/lib/config";
import {
  deliverOutgoingWebhooks,
  getAutomaticReplyCandidate,
  getSettingValue,
  isConversationAiEnabled,
  recordAgentReply,
  recordFollowUpSuggestion,
  recordIncomingMessage,
  recordWhatsAppMessageStatuses,
  saveMessageMedia,
  updateMessageBody
} from "@/lib/crm";
import { sendPushNotificationToAll } from "@/lib/push";
import { suggestPump } from "@/lib/selector";
import {
  downloadWhatsAppMedia,
  extractInboundMessages,
  extractMessageStatuses,
  formatAdReferralForAgent,
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
    const baseBody = isText ? agentMessage : getInboundMediaBody(message);
    // Contexto del anuncio (Click-to-WhatsApp): lo adjuntamos al cuerpo para que
    // lo vea el agente IA y el asesor humano en el chat.
    const adContext = formatAdReferralForAgent(message.referral);
    const initialBody = adContext ? `${baseBody}\n\n${adContext}` : baseBody;
    if (adContext) {
      agentMessage = agentMessage ? `${agentMessage}\n\n${adContext}` : adContext;
    }

    const stored = await recordIncomingMessage({
      phone: message.from,
      waMessageId: message.id,
      text: initialBody,
      contactName: message.contactName
    });

    if (stored.duplicate) {
      continue;
    }

    // Disparar webhook saliente 'mensaje_entrante' — incluye conversation_id
    // para que el admin externo (Febecos) pueda actualizar febo_inicio_at y
    // almacenar el conversationId para deep-link y sync de notas.
    deliverOutgoingWebhooks("mensaje_entrante", {
      conversation_id: stored.threadId,
      contact_id:      stored.contactId,
      phone:           message.from,
      message_id:      stored.messageId,
    }).catch((e) => console.error("outgoing webhook mensaje_entrante failed", e));

    if (isText && message.flowResponse && stored.messageId) {
      agentMessage = await buildSelectorFlowAgentMessage(agentMessage, message.flowResponse);
      await updateMessageBody(stored.messageId, agentMessage);
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

async function buildSelectorFlowAgentMessage(baseMessage: string, flowResponse: Record<string, unknown>) {
  const quoteInput = getSelectorInputFromFlow(flowResponse);

  if (!quoteInput) {
    return baseMessage;
  }

  const technicalContext = [
    "",
    "Datos normalizados para selector oficial:",
    `Altura total: ${quoteInput.heightMeters} m`,
    `Litros por dia: ${quoteInput.litersPerDay} L/dia`,
    `Diametro equivalente API: ${quoteInput.maxPumpDiameterInches} pulgadas`
  ];

  try {
    const result = await suggestPump(quoteInput);
    const suggestion = result.sugerencia;
    const quoteContext = [
      "",
      "Resultado oficial del selector Febecos:",
      `Equipo: ${[suggestion.codigo, suggestion.marca].filter(Boolean).join(" - ")}`,
      suggestion.watts ? `Potencia: ${suggestion.watts} W` : null,
      suggestion.cant_paneles ? `Paneles: ${suggestion.cant_paneles}` : null,
      suggestion.precio_full ? `Precio full: ${formatArs(suggestion.precio_full)}` : null,
      suggestion.cuota_mensual ? `Cuota mensual: ${formatArs(suggestion.cuota_mensual)}` : null,
      result.caudal_a_altura?.verano ? `Caudal verano: ${result.caudal_a_altura.verano} L/dia` : null,
      result.caudal_a_altura?.invierno ? `Caudal invierno: ${result.caudal_a_altura.invierno} L/dia` : null,
      typeof result.cobertura_pct === "number" ? `Cobertura: ${result.cobertura_pct}%` : null,
      result.nota ? `Nota: ${result.nota}` : null,
      result.es_fallback ? "Fallback: si" : "Fallback: no"
    ].filter(Boolean);

    return [baseMessage, ...technicalContext, ...quoteContext].join("\n");
  } catch (error) {
    return [
      baseMessage,
      ...technicalContext,
      "",
      `Error al consultar selector oficial: ${error instanceof Error ? error.message : "No pudimos consultar el selector."}`
    ].join("\n");
  }
}

function getSelectorInputFromFlow(flowResponse: Record<string, unknown>) {
  const litersPerDay = readNumber(flowResponse.litros_dia);
  const depth = readNumber(flowResponse.profundidad_pozo);
  const tankHeight = readNumber(flowResponse.altura_tanque);
  const horizontalDistance = readNumber(flowResponse.distancia_horizontal) ?? 0;
  const maxPumpDiameterInches = normalizeFlowDiameter(flowResponse.diametro_perforacion);

  if (!litersPerDay || !depth || !maxPumpDiameterInches) {
    return null;
  }

  return {
    heightMeters: depth + (tankHeight ?? 0) + horizontalDistance,
    litersPerDay,
    maxPumpDiameterInches,
    mode: typeof flowResponse.uso === "string" ? flowResponse.uso : null
  };
}

function normalizeFlowDiameter(value: unknown) {
  const numeric = readNumber(value);

  if (!numeric) {
    return null;
  }

  if (numeric <= 6) {
    return numeric;
  }

  if (numeric <= 63) {
    return 2;
  }

  if (numeric <= 80) {
    return 3;
  }

  if (numeric <= 110) {
    return 4;
  }

  return 6;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value.replace(",", ".").replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatArs(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
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
  const quietSeconds = await getAutomaticReplyDelaySeconds();
  const candidate = await getAutomaticReplyCandidate({
    conversationId: stored.threadId,
    messageId: stored.messageId,
    minQuietSeconds: quietSeconds
  });

  if (candidate.retryAfterMs > 0) {
    await sleep(Math.min(candidate.retryAfterMs + 500, quietSeconds * 1000));
    await sendAutomaticReply(input);
    return;
  }

  if (!candidate.shouldReply) {
    return;
  }

  const effectiveAgentMessage = candidate.combinedMessage?.trim() || agentMessage;

  if (interactiveId === WHATSAPP_BUTTON_TALK_TO_ADVISOR) {
    const handoffAnswer = "Perfecto. Te paso con un asesor de Febecos para que lo vean directo y coordinen como seguir. Tene en cuenta que la atencion de asesores es de 9 a 19 hs, en horario comercial; te van a contactar en cuanto haya uno disponible.";
    const sent = await sendWhatsAppText(message.from, handoffAnswer);

    await recordAgentReply({
      contactId: stored.contactId,
      threadId: stored.threadId,
      answer: handoffAnswer,
      intent: "caliente",
      needsHuman: true,
      waMessageId: getSentMessageId(sent)
    });
    await refreshMemorySafely(stored.threadId);

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
    await refreshMemorySafely(stored.threadId);

    return;
  }

  if (!effectiveAgentMessage) {
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
    await refreshMemorySafely(stored.threadId);

    return;
  }

  let result;
  try {
    result = await runFebecosAgent({
      phone: message.from,
      message: effectiveAgentMessage,
      contactName: message.contactName,
      conversationId: stored.threadId
    });
  } catch (error) {
    console.error("No pudimos generar respuesta automatica.", error);
    result = buildAgentFallbackResult();
  }

  // Re-chequeo final: si apagaron "IA Activa" mientras se generaba la respuesta
  // (la llamada al LLM puede tardar varios segundos), no enviar nada.
  if (!(await isConversationAiEnabled(stored.threadId))) {
    return;
  }

  // Si vino de publi y el agente metió todo en un solo mensaje (ignoró segundoMensaje),
  // forzamos el split programáticamente en el separador "---" o en el primer link del catálogo.
  if (adContext && !result.segundoMensaje) {
    const sepIdx = result.respuesta.search(/\n\s*---\s*\n/);
    const catalogIdx = result.respuesta.search(/Si quer/);
    const splitAt = sepIdx >= 0 ? sepIdx : catalogIdx;
    if (splitAt > 0) {
      const breakAt = sepIdx >= 0 ? result.respuesta.indexOf("\n", splitAt + 1) + 1 : splitAt;
      result = {
        ...result,
        respuesta: result.respuesta.slice(0, splitAt).trim(),
        segundoMensaje: result.respuesta.slice(breakAt).trim()
      };
    }
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

    // Si el agente generó un segundo mensaje (ej. publi), enviarlo aparte con demora natural
    if (result.segundoMensaje) {
      await sleep(30_000); // 30 s de pausa para que parezca más humano
      await sendWhatsAppText(message.from, result.segundoMensaje);
    }

    await recordAgentReply({
      contactId: stored.contactId,
      threadId: stored.threadId,
      answer: result.segundoMensaje
        ? `${result.respuesta}\n\n---\n\n${result.segundoMensaje}`
        : result.respuesta,
      intent: result.consultype,
      needsHuman,
      waMessageId: getSentMessageId(sent),
      replyOptions: sentReplyOptions
    });

    const followUpDueAt = inferDeferredFollowUpDueAt(effectiveAgentMessage);
    if (result.consultype === "seguimiento" && followUpDueAt) {
      await recordFollowUpSuggestion({
        contactId: stored.contactId,
        threadId: stored.threadId,
        phone: message.from,
        dueAt: followUpDueAt,
        reason: "Cliente postergo la decision y FEBO ofrecio seguimiento activo."
      });
    }

    await refreshMemorySafely(stored.threadId);
  } catch (error) {
    console.error("No pudimos enviar o registrar la respuesta automatica.", error);
  }
}

async function refreshMemorySafely(conversationId: string | null | undefined) {
  try {
    await refreshConversationMemory(conversationId);
  } catch (error) {
    console.error("No pudimos actualizar la memoria comercial.", error);
  }
}

async function waitBeforeAutomaticReply() {
  const safeDelaySeconds = await getAutomaticReplyDelaySeconds();
  await sleep(safeDelaySeconds * 1000);
}

async function getAutomaticReplyDelaySeconds() {
  const configuredDelay = await getSettingValue("auto_reply_delay_seconds", Number(process.env.FEBO_AUTO_REPLY_DELAY_SECONDS ?? DEFAULT_AUTO_REPLY_DELAY_SECONDS));
  const delaySeconds = Number(configuredDelay);
  return Number.isFinite(delaySeconds) && delaySeconds >= 0 ? delaySeconds : DEFAULT_AUTO_REPLY_DELAY_SECONDS;
}

function inferDeferredFollowUpDueAt(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(par\s+de\s+meses|dos\s+meses|2\s+meses)\b/.test(normalized)) {
    return addDays(new Date(), 60);
  }

  if (/\b(tres\s+meses|3\s+meses)\b/.test(normalized)) {
    return addDays(new Date(), 90);
  }

  if (/\b(un\s+mes|1\s+mes)\b/.test(normalized)) {
    return addDays(new Date(), 30);
  }

  if (/\b(en\s+unos\s+meses|mas\s+adelante|proxima\s+temporada|invierno|cuando\s+junte|cuando\s+tenga\s+la\s+plata)\b/.test(normalized)) {
    return addDays(new Date(), 90);
  }

  return null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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
    respuesta: "Recibimos tu consulta. Te paso con un asesor de Febecos para que lo revise y te responda bien. Tene en cuenta que la atencion de asesores es de 9 a 19 hs, en horario comercial; te van a contactar en cuanto haya uno disponible.",
    segundoMensaje: null,
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
