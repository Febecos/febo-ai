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
  perforationDepthMeters: z.number().nullable(),
  waterLevelMeters: z.number().nullable(),
  tankHeightMeters: z.number().nullable(),
  heightMeters: z.number().nullable(),
  litersPerDay: z.number().nullable(),
  rawDiameter: z.string().nullable(),
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
      "Si tu respuesta dice que vas a pasar, derivar o conectar al cliente con un asesor, vendedor, agente humano o Equipo FEBECOS, entonces escalar debe ser true.",
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
      "Distingui profundidad total del pozo/perforacion de nivel de agua/espejo de agua. Si el cliente dice que el agua esta a X metros, eso es waterLevelMeters y manda para calcular heightMeters.",
      "La profundidad total del pozo solo sirve como fallback si no hay nivel de agua. No sumes profundidad total si el cliente ya dio nivel de agua.",
      "Si hay nivel de agua y altura de tanque, usa heightMeters = nivel de agua + altura de tanque. Si hay nivel de agua pero no altura de tanque, usa nivel de agua + 5 y agrega esa suposicion.",
      "Si no hay nivel de agua pero hay profundidad total y altura de tanque, usa heightMeters = profundidad total + altura de tanque. Si falta altura de tanque, usa +5 y agrega esa suposicion.",
      "Si el cliente da altura total/MCA explicitamente, usa ese valor como heightMeters salvo que tambien haya nivel de agua y altura de tanque mas especificos.",
      "rawDiameter debe conservar la frase literal del diametro/camisa/cano/perforacion.",
      "Para diametro maximo compatible: camisa/cano/pozo/perforacion de 3 pulgadas o 3 pulgadas reales => maxPumpDiameterInches=2, nunca 3; 63mm/75mm/76mm => 2; 80-100mm => 3; 110mm/115mm/4 pulgadas o mas => 4; 6 pulgadas o pozo grande => 4.",
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
            "perforationDepthMeters",
            "waterLevelMeters",
            "tankHeightMeters",
            "heightMeters",
            "litersPerDay",
            "rawDiameter",
            "maxPumpDiameterInches",
            "mode",
            "missingData",
            "assumptions"
          ],
          properties: {
            shouldQuote: { type: "boolean" },
            hasEnoughData: { type: "boolean" },
            perforationDepthMeters: { type: ["number", "null"] },
            waterLevelMeters: { type: ["number", "null"] },
            tankHeightMeters: { type: ["number", "null"] },
            heightMeters: { type: ["number", "null"] },
            litersPerDay: { type: ["number", "null"] },
            rawDiameter: { type: ["string", "null"] },
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

  const parsed = quoteExtractionSchema.parse(JSON.parse(normalizeJson(response.output_text)));
  return normalizeQuoteExtraction(parsed, input);
}

function normalizeQuoteExtraction(
  extraction: QuoteExtraction,
  input: { message: string; history: ReturnType<typeof buildConversationHistory> }
): QuoteExtraction {
  const sourceText = [
    ...input.history
      .filter((message) => message.speaker === "cliente" || message.speaker === "humano_febecos")
      .map((message) => message.text),
    input.message,
    extraction.rawDiameter ?? ""
  ].join("\n");
  const assumptions = [...extraction.assumptions];
  const missingData = new Set(extraction.missingData);
  const tankHeightMeters = normalizePositiveNumber(extraction.tankHeightMeters) ?? inferTankHeightMeters(sourceText);
  const waterLevelMeters = normalizePositiveNumber(extraction.waterLevelMeters) ?? inferWaterLevelMeters(sourceText);
  const perforationDepthMeters = normalizePositiveNumber(extraction.perforationDepthMeters) ?? inferPerforationDepthMeters(sourceText);
  let heightMeters = normalizePositiveNumber(extraction.heightMeters);
  const maxPumpDiameterInches = normalizePumpDiameter(sourceText, extraction.maxPumpDiameterInches);

  if (waterLevelMeters) {
    const tank = tankHeightMeters ?? 5;
    heightMeters = waterLevelMeters + tank;
    if (!tankHeightMeters) {
      assumptions.push("altura de tanque asumida en 5 m porque el cliente no la informo");
    }
    assumptions.push("altura calculada con nivel de agua, no con profundidad total del pozo");
  } else if (!heightMeters && perforationDepthMeters) {
    const tank = tankHeightMeters ?? 5;
    heightMeters = perforationDepthMeters + tank;
    if (!tankHeightMeters) {
      assumptions.push("altura de tanque asumida en 5 m porque el cliente no la informo");
    }
    assumptions.push("sin nivel de agua informado, se uso profundidad total como fallback");
  }

  if (heightMeters) {
    missingData.delete("altura");
    missingData.delete("profundidad");
    missingData.delete("nivel de agua");
  }

  if (maxPumpDiameterInches) {
    missingData.delete("diametro");
    missingData.delete("diámetro");
  }

  if (extraction.litersPerDay) {
    missingData.delete("consumo diario");
    missingData.delete("litros por dia");
    missingData.delete("litros por día");
  }

  return {
    ...extraction,
    hasEnoughData: Boolean(heightMeters && extraction.litersPerDay && maxPumpDiameterInches),
    perforationDepthMeters,
    waterLevelMeters,
    tankHeightMeters,
    heightMeters,
    maxPumpDiameterInches,
    missingData: Array.from(missingData),
    assumptions: Array.from(new Set(assumptions))
  };
}

function normalizePositiveNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizePumpDiameter(sourceText: string, extracted: number | null) {
  const text = sourceText.toLowerCase();
  const millimeters = Array.from(text.matchAll(/(\d{2,3})\s*mm/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  if (/(^|[^\d])3\s*(?:"|”|pulg(?:adas?)?)/i.test(sourceText) || millimeters.some((value) => value >= 63 && value <= 76)) {
    return 2;
  }

  if (millimeters.some((value) => value >= 80 && value <= 100)) {
    return 3;
  }

  if (
    /(^|[^\d])(?:4|5|6)\s*(?:"|”|pulg(?:adas?)?)/i.test(sourceText) ||
    millimeters.some((value) => value >= 110)
  ) {
    return 4;
  }

  return normalizePositiveNumber(extracted);
}

function inferWaterLevelMeters(sourceText: string) {
  return findMeters(sourceText, [
    /(?:agua|nivel de agua|espejo de agua)\s+(?:esta|está|se encuentra|queda|arranca)?\s*(?:a|en)?\s*([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)/i,
    /([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)\s+(?:de\s+)?(?:agua|nivel de agua|espejo de agua)/i
  ]);
}

function inferPerforationDepthMeters(sourceText: string) {
  return findMeters(sourceText, [
    /(?:pozo|perforacion|perforación|profundidad)\s+(?:de|tiene|esta|está|es|a)?\s*([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)/i,
    /([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)\s+(?:de\s+)?(?:profundidad|pozo|perforacion|perforación)/i
  ]);
}

function inferTankHeightMeters(sourceText: string) {
  return findMeters(sourceText, [
    /(?:tanque|deposito|depósito)[^.\n]{0,60}?([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)\s*(?:de\s+)?(?:altura|alto)?/i,
    /([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)\s+(?:de\s+)?(?:altura\s+)?(?:al\s+)?(?:tanque|deposito|depósito)/i
  ]);
}

function findMeters(sourceText: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    const value = match?.[1] ? parseSpokenNumber(match[1]) : null;
    if (value) {
      return value;
    }
  }

  return null;
}

function parseSpokenNumber(value: string) {
  const normalized = value.toLowerCase().replace(",", ".").trim();
  const numeric = Number(normalized);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const words: Record<string, number> = {
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10
  };

  return words[normalized] ?? null;
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
