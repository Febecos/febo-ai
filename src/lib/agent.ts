import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { config, requireEnv } from "./config";
import { AgentConversationMessage, listAgentConversationContext } from "./crm";
import { createLead, createSupportTicket, getProfileByPhone, platformFallbackContext, recordPlatformEvent } from "./febecos";
import { SelectorPumpResult, suggestPump } from "./selector";

const consultypeValues = [
  "saludo",
  "informacion",
  "disponibilidad",
  "accion",
  "problema",
  "seguimiento",
  "caliente",
  "comparador",
  "reserva-7-dias",
  "sin-perforacion",
  "proyecto-futuro",
  "otro"
] as const;

const agentSchema = z.object({
  respuesta: z.string(),
  sentimiento: z.enum(["positivo", "neutral", "preocupado", "molesto"]),
  consultype: z.enum(consultypeValues),
  escalar: z.boolean(),
  nombre: z.string().nullable(),
  imagenes: z.array(z.string()),
  archivos: z.array(z.string()),
  action: z.enum(["none", "create_lead", "create_ticket", "record_event"]),
  actionSubject: z.string().nullable()
});

export type AgentResult = z.infer<typeof agentSchema>;

const quoteExtractionSchema = z.object({
  shouldQuote: z.boolean(),
  hasEnoughData: z.boolean(),
  heightMeters: z.number().nullable(),
  litersPerDay: z.number().nullable(),
  maxPumpDiameterInches: z.number().nullable(),
  mode: z.enum(["molino", "generador", "molino_generador"]).nullable(),
  missingData: z.array(z.string()),
  assumptions: z.array(z.string())
});

type QuoteExtraction = z.infer<typeof quoteExtractionSchema>;

let openai: OpenAI | null = null;
let operatingPrompt: string | null = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }

  return openai;
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

function normalizeJson(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1] : trimmed;
}

async function getOperatingPrompt() {
  if (!operatingPrompt) {
    operatingPrompt = await readFile(path.join(process.cwd(), "src", "prompts", "febo-ai-v1.md"), "utf8");
  }

  return operatingPrompt;
}

export async function transcribeAudio(input: {
  dataBase64: string;
  mimeType: string;
  filename?: string | null;
}) {
  const buffer = Buffer.from(input.dataBase64, "base64");
  const extension = audioExtensionForMime(input.mimeType);
  const file = await toFile(buffer, input.filename ?? `audio.${extension}`, { type: input.mimeType });

  const transcription = await getOpenAI().audio.transcriptions.create({
    file,
    language: "es",
    model: "gpt-4o-mini-transcribe",
    prompt: "Audio de WhatsApp en espanol rioplatense sobre bombas de agua, perforaciones, FEBECOS y consultas comerciales."
  });

  return transcription.text.trim();
}

export async function runFebecosAgent(input: {
  phone: string;
  message: string;
  contactName?: string;
  conversationId?: string | null;
}): Promise<AgentResult> {
  const profile = await getProfileByPhone(input.phone);
  const fallback = platformFallbackContext();
  const prompt = await getOperatingPrompt();
  const history = await listAgentConversationContext(input.conversationId, 30);
  const conversationHistory = buildConversationHistory(history);
  const quoteExtraction = await extractQuoteRequest({
    message: input.message,
    history: conversationHistory
  });
  const selectorQuote = await getSelectorQuote(quoteExtraction);

  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      prompt,
      "Regla critica de contexto: usa el historial de conversacion como fuente principal para entender el caso. No trates cada mensaje como si fuera el primer contacto.",
      "No repreguntes datos que el cliente ya dio en el historial. Si faltan datos, pregunta solo el dato faltante mas importante.",
      "Responde al ultimo mensaje del cliente, pero manteniendo continuidad con lo ya conversado.",
      "Si el historial muestra que un humano ya tomo la conversacion o la IA esta pausada, no intentes cerrar ni avanzar por tu cuenta.",
      "Cuando el contexto incluya selectorQuote, usalo como unica fuente para modelo, precio, caudal, stock y cuotas. No digas que no tenes acceso al sistema.",
      "Si selectorQuote no esta disponible pero falta algun dato tecnico, pedi solo ese dato. No inventes precios ni modelos.",
      "Si selectorQuote.error existe, deriva o pedi disculpas brevemente; no inventes una cotizacion alternativa.",
      "Regla de integracion: devolve exclusivamente JSON valido con las claves del esquema pedido.",
      "No muestres el JSON al usuario final; el campo respuesta es el unico texto que se envia por WhatsApp.",
      "Si no hay catalogo, stock o precio disponible en el contexto, no inventes modelos ni importes: pedi el dato faltante o escala segun las reglas del prompt."
    ].join("\n\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              whatsapp: {
                phone: input.phone,
                name: input.contactName ?? null,
                message: input.message,
                history: conversationHistory
              },
              febecos: {
                profile,
                fallback,
                selectorQuote
              },
              outputSchema: {
                respuesta: "respuesta lista para enviar por WhatsApp",
                sentimiento: "positivo | neutral | preocupado | molesto",
                consultype: consultypeValues.join(" | "),
                escalar: "boolean",
                nombre: "nombre detectado o null",
                imagenes: "array de ids/urls de imagenes a enviar, si aplica",
                archivos: "array de ids/urls de archivos a enviar, si aplica",
                action: "none | create_lead | create_ticket | record_event",
                actionSubject: "resumen corto opcional"
              }
            })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "febo_ai_whatsapp_agent_response",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "respuesta",
            "sentimiento",
            "consultype",
            "escalar",
            "nombre",
            "imagenes",
            "archivos",
            "action",
            "actionSubject"
          ],
          properties: {
            respuesta: { type: "string" },
            sentimiento: {
              type: "string",
              enum: ["positivo", "neutral", "preocupado", "molesto"]
            },
            consultype: {
              type: "string",
              enum: [...consultypeValues]
            },
            escalar: { type: "boolean" },
            nombre: { type: ["string", "null"] },
            imagenes: {
              type: "array",
              items: { type: "string" }
            },
            archivos: {
              type: "array",
              items: { type: "string" }
            },
            action: {
              type: "string",
              enum: ["none", "create_lead", "create_ticket", "record_event"]
            },
            actionSubject: { type: ["string", "null"] }
          }
        },
        strict: true
      }
    }
  });

  const parsed = agentSchema.parse(JSON.parse(normalizeJson(response.output_text)));

  await executeAgentAction({
    phone: input.phone,
    message: input.message,
    result: parsed
  });

  return parsed;
}

function buildConversationHistory(history: AgentConversationMessage[]) {
  return history.map((message) => ({
    speaker:
      message.direction === "inbound"
        ? "cliente"
        : message.source === "manual"
          ? "humano_febecos"
          : "febo_ai",
    text: message.body,
    consultype: message.consultype,
    needsHuman: message.needs_human,
    at: message.created_at
  }));
}

async function extractQuoteRequest(input: {
  message: string;
  history: ReturnType<typeof buildConversationHistory>;
}): Promise<QuoteExtraction> {
  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      "Extrae datos para cotizar una bomba solar Febecos desde una conversacion de WhatsApp.",
      "No respondas al cliente. Solo devolve JSON.",
      "shouldQuote=true si el cliente pide precio/cotizacion/modelo o si ya dio datos suficientes para cotizar.",
      "hasEnoughData=true solo si hay altura/profundidad, consumo diario y diametro maximo de bomba compatible.",
      "Para ganado calcula litrosPerDay = animales * 60.",
      "Si hay profundidad pero no altura de tanque, usa heightMeters = profundidad + 5 y agrega esa suposicion.",
      "Si el cliente da altura total/MCA, usa ese valor como heightMeters.",
      "Para diametro: 63mm o 75mm o 3 pulgadas reales => maxPumpDiameterInches=2; 80-100mm => 3; 110mm, 115mm, 4 pulgadas o mas => 4; 6 pulgadas o pozo grande => 4.",
      "Si falta diametro, incluilo en missingData y hasEnoughData=false.",
      "mode puede ser molino, generador o molino_generador si el cliente menciona sistema actual; si no, null."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              ultimoMensaje: input.message,
              historial: input.history
            })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "febo_ai_quote_extraction",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "shouldQuote",
            "hasEnoughData",
            "heightMeters",
            "litersPerDay",
            "maxPumpDiameterInches",
            "mode",
            "missingData",
            "assumptions"
          ],
          properties: {
            shouldQuote: { type: "boolean" },
            hasEnoughData: { type: "boolean" },
            heightMeters: { type: ["number", "null"] },
            litersPerDay: { type: ["number", "null"] },
            maxPumpDiameterInches: { type: ["number", "null"] },
            mode: { type: ["string", "null"], enum: ["molino", "generador", "molino_generador", null] },
            missingData: { type: "array", items: { type: "string" } },
            assumptions: { type: "array", items: { type: "string" } }
          }
        },
        strict: true
      }
    }
  });

  return quoteExtractionSchema.parse(JSON.parse(normalizeJson(response.output_text)));
}

async function getSelectorQuote(extraction: QuoteExtraction):
  Promise<
    | {
        status: "not_requested" | "missing_data";
        missingData?: string[];
        assumptions?: string[];
      }
    | {
        status: "ok";
        inputs: QuoteExtraction;
        result: SelectorPumpResult;
      }
    | {
        status: "error";
        inputs: QuoteExtraction;
        error: string;
      }
  > {
  if (!extraction.shouldQuote) {
    return { status: "not_requested" };
  }

  if (
    !extraction.hasEnoughData ||
    !extraction.heightMeters ||
    !extraction.litersPerDay ||
    !extraction.maxPumpDiameterInches
  ) {
    return {
      status: "missing_data",
      missingData: extraction.missingData,
      assumptions: extraction.assumptions
    };
  }

  try {
    const result = await suggestPump({
      heightMeters: extraction.heightMeters,
      litersPerDay: extraction.litersPerDay,
      maxPumpDiameterInches: extraction.maxPumpDiameterInches,
      mode: extraction.mode
    });

    return { status: "ok", inputs: extraction, result };
  } catch (error) {
    return {
      status: "error",
      inputs: extraction,
      error: error instanceof Error ? error.message : "No pudimos consultar el motor selector."
    };
  }
}

async function executeAgentAction(input: {
  phone: string;
  message: string;
  result: AgentResult;
}) {
  if (input.result.action === "create_lead") {
    await createLead({
      phone: input.phone,
      message: input.message,
      intent: input.result.consultype
    });
    return;
  }

  if (input.result.action === "create_ticket" || input.result.escalar) {
    await createSupportTicket({
      phone: input.phone,
      subject: input.result.actionSubject ?? input.result.consultype,
      message: input.message,
      priority: input.result.sentimiento === "molesto" ? "high" : "normal"
    });
    return;
  }

  if (input.result.action === "record_event") {
    await recordPlatformEvent({
      phone: input.phone,
      event: input.result.consultype,
      payload: {
        message: input.message,
        answer: input.result.respuesta
      }
    });
  }
}
