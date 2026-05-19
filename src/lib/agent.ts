import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { config, requireEnv } from "./config";
import { listAgentConversationContext } from "./crm";
import { createLead, createSupportTicket, getProfileByPhone, platformFallbackContext, recordPlatformEvent } from "./febecos";

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

  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      prompt,
      "Regla critica de contexto: usa el historial de conversacion como fuente principal para entender el caso. No trates cada mensaje como si fuera el primer contacto.",
      "No repreguntes datos que el cliente ya dio en el historial. Si faltan datos, pregunta solo el dato faltante mas importante.",
      "Responde al ultimo mensaje del cliente, pero manteniendo continuidad con lo ya conversado.",
      "Si el historial muestra que un humano ya tomo la conversacion o la IA esta pausada, no intentes cerrar ni avanzar por tu cuenta.",
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
                history: history.map((message) => ({
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
                }))
              },
              febecos: {
                profile,
                fallback
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
