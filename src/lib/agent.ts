import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { config, requireEnv } from "./config";
import {
  AgentConversationMessage,
  ConversationMemory,
  getAgentContactContext,
  getConversationMemory,
  listLabelDefinitions,
  listAgentConversationContext,
  upsertConversationMemory
} from "./crm";
import { createLead, createSupportTicket, getProfileByPhone, platformFallbackContext, recordPlatformEvent } from "./febecos";
import { getApprovedLearningsText } from "./learnings";
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
  segundoMensaje: z.string().nullable(),
  sentimiento: z.enum(["positivo", "neutral", "preocupado", "molesto"]),
  consultype: z.string(),
  escalar: z.boolean(),
  nombre: z.string().nullable(),
  imagenes: z.array(z.string()),
  archivos: z.array(z.string()),
  action: z.enum(["none", "create_lead", "create_ticket", "record_event", "send_selector_flow"]),
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

const memorySchema = z.object({
  summary: z.string(),
  technicalFacts: z.object({
    zona: z.string().nullable(),
    uso: z.string().nullable(),
    litrosDia: z.string().nullable(),
    alturaTotal: z.string().nullable(),
    profundidadPozo: z.string().nullable(),
    nivelAgua: z.string().nullable(),
    alturaTanque: z.string().nullable(),
    distanciaHorizontal: z.string().nullable(),
    diametro: z.string().nullable(),
    equipoSugerido: z.string().nullable(),
    precio: z.string().nullable(),
    cuotas: z.string().nullable(),
    stock: z.string().nullable(),
    selectorOrigen: z.string().nullable(),
    notasTecnicas: z.string().nullable()
  }),
  commercialFacts: z.object({
    estadoCompra: z.string().nullable(),
    intencion: z.string().nullable(),
    asesorAsignado: z.string().nullable(),
    presupuestoEnviado: z.string().nullable(),
    formaPago: z.string().nullable(),
    envioFactura: z.string().nullable(),
    objeciones: z.string().nullable(),
    proximoPaso: z.string().nullable()
  }),
  pendingQuestions: z.array(z.string()),
  lastIntent: z.string().nullable(),
  lastTopic: z.string().nullable()
});

type ConversationMemoryUpdate = z.infer<typeof memorySchema>;

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
    const base = await readFile(path.join(process.cwd(), "src", "prompts", "febo-ai-v1.md"), "utf8");
    // Memoria de Febo: aprendizajes de respuestas reales (alta prioridad).
    let learnings = "";
    try {
      learnings = await readFile(path.join(process.cwd(), "src", "prompts", "aprendizajes-febo.md"), "utf8");
    } catch {
      learnings = "";
    }
    operatingPrompt = learnings
      ? `${base}\n\n---\n\n# ⭐ MEMORIA DE FEBO (aprendizajes recientes — máxima prioridad)\n\n${learnings}`
      : base;
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
  const basePrompt = await getOperatingPrompt();
  // Aprendizajes APROBADOS (revisados por un humano) que se inyectan en vivo.
  const approvedLearnings = await getApprovedLearningsText(Date.now()).catch(() => "");
  const prompt = approvedLearnings
    ? `${basePrompt}\n\n---\n\n# ⭐ APRENDIZAJES APROBADOS (alta prioridad — revisados por el equipo)\n\n${approvedLearnings}`
    : basePrompt;
  const history = await listAgentConversationContext(input.conversationId, 50);
  const memory = await getConversationMemory(input.conversationId);
  const contactContext = await getAgentContactContext(input.conversationId);
  const labelDefinitions = await listLabelDefinitions();
  const allowedConsultypes = Array.from(
    new Set([...consultypeValues, ...labelDefinitions.filter((label) => label.active).map((label) => label.slug)])
  );
  const conversationHistory = buildConversationHistory(history);
  const conversationMemory = buildConversationMemoryContext(memory);
  const selectorCheckoutResult = buildSelectorCheckoutResult(input.message);

  if (selectorCheckoutResult) {
    await executeAgentAction({
      phone: input.phone,
      message: input.message,
      result: selectorCheckoutResult
    });

    return selectorCheckoutResult;
  }

  const paymentPreferenceResult = buildPaymentPreferenceResult(input.message, conversationHistory);

  if (paymentPreferenceResult) {
    await executeAgentAction({
      phone: input.phone,
      message: input.message,
      result: paymentPreferenceResult
    });

    return paymentPreferenceResult;
  }

  const farewellResult = buildFarewellResult(input.message, conversationHistory);

  if (farewellResult) {
    await executeAgentAction({
      phone: input.phone,
      message: input.message,
      result: farewellResult
    });

    return farewellResult;
  }

  const quoteExtraction = await extractQuoteRequest({
    message: input.message,
    history: conversationHistory,
    memory: conversationMemory
  });
  const selectorQuote = await getSelectorQuote(quoteExtraction);

  if (isInsufficientCoverageQuote(selectorQuote)) {
    const result = buildInsufficientCoverageResult(selectorQuote);

    await executeAgentAction({
      phone: input.phone,
      message: input.message,
      result
    });

    return result;
  }

  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      prompt,
      "Regla critica de contexto: usa el historial de conversacion como fuente principal para entender el caso. No trates cada mensaje como si fuera el primer contacto.",
      "Usa memoriaComercial como contexto persistente del contacto: datos tecnicos, cotizaciones, objeciones, asesor y proximo paso. Esa memoria pesa mas que un mensaje aislado.",
      "Regla anti-repeticion: si memoriaComercial o history muestran que ya diste modelo, precio, cuotas o derivacion, no vuelvas a redactar todo. Responde solo el nuevo punto del cliente y avanza al proximo paso.",
      "BREVEDAD (regla critica, casi siempre): responde en MAXIMO 4-5 renglones cortos. Responde SOLO lo que el cliente pregunto; no agregues explicaciones que no pidio (nada de rendimiento de invierno, ventajas largas, 'te cubre tantos litros', etc). Nada de listas numeradas largas: si faltan datos, pedilos en UNA linea (ej 'pasame profundidad, diametro y para que uso'). Lo que no sabes, lo preguntas corto (2-3 palabras). Una cotizacion nueva puede ser un poco mas larga (modelo + precio + link) pero igual concisa, sin parrafos de mas.",
      "Si el cliente responde corto despues de una cotizacion (por ejemplo 'si', 'dale', 'ok', '6 cuotas', 'contado', 'me interesa', 'pasame datos'), asumilo como continuidad de la cotizacion previa. No reinicies la venta ni vuelvas a pedir datos tecnicos.",
      "Si en history ya dijiste que lo pasabas/derivabas a un asesor, no vuelvas a preguntar si quiere asesor. Confirma que ya quedo derivado y aclara que la atencion de asesores es de 9 a 19 hs, en horario comercial, salvo que el cliente pida seguir con la IA.",
      "Usa etiquetasDisponibles para entender que significa cada etiqueta operativa y como deberia clasificarse o priorizarse el contacto.",
      "El campo consultype debe ser el slug exacto de una etiqueta activa de etiquetasDisponibles o uno de los tipos base permitidos. Si una etiqueta indica transferir/asignar a un vendedor, usa ese slug y deja escalar=true.",
      "No repreguntes datos que el cliente ya dio en el historial. Si faltan datos, pregunta solo el dato faltante mas importante.",
      "Si el ultimo mensaje puede ser continuidad de un caso viejo, asumilo como continuidad cuando menciona cuotas, pago, entrega, envio, stock, precio, medidas, instalacion o asesor. Solo pregunta si siguen con eso o si es algo nuevo cuando realmente no haya forma de inferir el tema.",
      "Si contactoPrevio indica imported_from='hariaz' o que la conversacion existia antes del primer mensaje local, tratala como contacto recurrente aunque history tenga pocos mensajes. No saludes como contacto nuevo: pregunta corto si quieren seguir con el presupuesto/conversacion anterior o si es una consulta nueva.",
      "Si contactoPrevio trae imported_payload con nombre o tipo, usalo como pista operativa, pero no inventes el contenido exacto de un presupuesto si no esta en history o memoriaComercial.",
      "Responde al ultimo mensaje del cliente, pero manteniendo continuidad con lo ya conversado.",
      "Si el historial muestra que un humano ya tomo la conversacion o la IA esta pausada, no intentes cerrar ni avanzar por tu cuenta.",
      "PROHIBIDO INVENTAR EQUIPOS (regla critica): el modelo, los watts, la cantidad de paneles, el codigo y el precio SOLO pueden salir de selectorQuote.result.sugerencia. NUNCA los deduzcas, estimes ni inventes vos. Si selectorQuote.status NO es 'ok', NO des ningun equipo, watts, paneles ni precio: pedi el dato tecnico que falte (nivel de agua o profundidad, diametro de la perforacion, y litros/dia o uso) o deci que lo calculas con un asesor. Dar un equipo o precio sin selectorQuote.status='ok' es un error grave.",
      "Link de ficha: en una COTIZACION (con selectorQuote.status='ok') usa SIEMPRE el url_slug: https://selector.febecos.com/catalogo-v2/{result.sugerencia.url_slug}; nunca lo armes a mano. EXCEPCION: si el cliente viene de una PUBLI que promociona un modelo puntual (sin selectorQuote todavia), si podes linkear la ficha de ESE modelo del anuncio armando https://selector.febecos.com/catalogo-v2/kit-bomba-solar-{diametro}-{watts}w-completo (ej 4\" 500W -> kit-bomba-solar-4-500w-completo). El precio lo ve el cliente en la ficha; vos no lo digas. Eso NO es dimensionar ni inventar: el modelo lo define la publi.",
      `Hora actual en Argentina: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false })} hs. SALUDO: usalo SOLO si 'history' esta vacio o tiene UN SOLO mensaje (primera respuesta). Si ya hay historial de ida y vuelta, NO saludes — arranca directo con la respuesta. Nunca repitas 'Buen día', 'Buenas tardes' ni el nombre del cliente en mensajes de seguimiento de la misma conversacion.`,
      "Cuando el cliente VIENE DE UNA PUBLI (hay bloque [Vino de un anuncio de Meta...] con un modelo), OBLIGATORIO usar DOS campos separados y consultype='lead-publi'. Campo 'respuesta' = saludo segun hora + nombre modelo EXACTO ('kit FULL {diametro}\" {watts}W', sin palabras extra del anuncio como 'para aguadas' o 'automatico') + link ficha. Campo 'segundoMensaje' = EXACTAMENTE: 'Si queres ver y analizar otras opciones, date una vuelta por el catalogo completo en este link\nhttps://selector.febecos.com/catalogo\n\nEn caso que quieras calcularlo vos, te invito a experimentar en 2 minutos nuestra herramienta gratuita online.\nTe va a solicitar los datos minimos necesarios, para analizar todo lo que necesita tu campo aqui y si dejas el e-mail podes acceder a un informe completo con el Retorno de la Inversion (ROI) que te ayudara a tomar una decision inteligente.\nIngresa ahora a este link https://selector.febecos.com/formulario\n\nCualquier asesoramiento mas especifico, escribime por aca y seguimos.' — NUNCA uses '---' ni pongas el segundo mensaje dentro de 'respuesta'. Slug: kit-bomba-solar-{diam}-{watts}w-completo. NO digas NINGUN numero de specs.",
      "LINKS: siempre como URL pelada (https://...). NUNCA en formato markdown [texto](url). WhatsApp no renderiza markdown y se ve roto. Un solo link por idea, con el slug correcto.",
      "ELECCION DE ETIQUETA (consultype) — fuente principal: usa la lista 'etiquetasDisponibles' del contexto. Cada etiqueta trae 'instructions' que es su 'Descripcion para la IA' cargada por el equipo. Revisa TODAS y elegi la etiqueta cuyo 'instructions' mejor describa el estado actual de la conversacion. Esas descripciones MANDAN sobre cualquier ejemplo del prompt. Si dos encajan, elegi la mas especifica al momento comercial (ej: si ya cotizaste, 'cotizado' o 'caliente' antes que una generica).",
      "Etiqueta (consultype): apenas le pasas el PRECIO/cotizacion al cliente, consultype='cotizado' (o 'caliente' si ademas dijo que quiere avanzar/comprar/pagar). 'pasar-presupuesto' es SOLO mientras el precio esta pendiente (pidio precio pero todavia no se lo diste). NUNCA dejes 'pasar-presupuesto' despues de haber pasado el precio.",
      "Cuando el contexto incluya selectorQuote, usalo como unica fuente para modelo, precio, caudal, stock y cuotas. No digas que no tenes acceso al sistema.",
      "Dentro de selectorQuote, los campos autoritativos son result.sugerencia.precio_full, result.sugerencia.cant_paneles, result.sugerencia.watts, result.sugerencia.codigo y result.caudal_a_altura. No recalcules precio ni cantidad de paneles.",
      "SIEMPRE que des una cotizacion (con selectorQuote.status='ok'), inclui en el MISMO mensaje el link de la ficha usando el url_slug autoritativo: https://selector.febecos.com/catalogo-v2/{result.sugerencia.url_slug}. Frase: 'Podes ver todos los datos de este equipo online aca: {link}'. Nunca inventes el slug.",
      "Si selectorQuote.status='ok' y result.cobertura_insuficiente=true, no cotices precio ni modelo: explica brevemente que requiere armado a medida y escala a asesor humano.",
      "Si el cliente ya dio datos tecnicos suficientes para cotizar: profundidad o altura total, altura de tanque si aplica, diametro/perforacion, litros o uso/cantidad de animales, y destino de uso, no envies Flow. Usa selectorQuote si esta disponible y cotiza con esos datos.",
      "Cuando ya diste una cotizacion y el cliente todavia no confirmo compra pero puede querer cuotas o asesor, no derives de una: pregunta 'Si queres verlo en cuotas o preferis hablar con un asesor, te ayudo. Como te gustaria verlo?'.",
      "No envies el WhatsApp Flow del selector automaticamente. Si el cliente pide calcular, usar el selector, dimensionar una bomba o cargar sus datos desde cero dentro de WhatsApp, pedi el dato tecnico faltante mas importante o deci que pueden enviarle el selector si quiere, pero usa action='none'.",
      "Si el cliente dice que es instalador, pocero, revendedor, tecnico, o que es novato/esta empezando en sistemas solares, ademas de resolver su consulta preguntale si quiere sumarse a la red/canal de instaladores de Febecos para recibir soporte y condiciones del gremio. No lo derives automaticamente salvo que pida hablar con alguien o quiera sumarse.",
      "Si el cliente solo responde '6 cuotas', 'seis cuotas' o 'contado' despues de una cotizacion, no repitas la cotizacion completa: confirma la preferencia en una frase y ofrece hablar con asesor.",
      "Cuando ofrezcas asesor sin que el cliente lo haya confirmado explicitamente, no escribas 'te paso' ni 'te derivo': pregunta si quiere hablar con un asesor y deja escalar=false para que WhatsApp muestre botones de confirmacion.",
      "Si el cliente dice que lo va a hacer en un par de meses, mas adelante, en unos meses, en invierno, la proxima temporada o cuando junte plata, no cierres con 'escribinos'. Deci que el precio/stock sirve como referencia de hoy y ofrece seguimiento activo: 'si queres, te dejamos agendado para escribirte cerca de esa fecha'. Si no dio fecha clara, pregunta que mes o fecha aproximada le sirve. Usa consultype='seguimiento', escalar=false, action='record_event' y actionSubject='seguimiento futuro'.",
      "Si el cliente pide algo puntual nombrando una potencia o modelo (ej '500W', 'kit full de 500') y hay selectorQuote.status='ok', pasale el link de la ficha usando el url_slug: https://selector.febecos.com/catalogo-v2/{result.sugerencia.url_slug}. Pasalo asi: 'Aca podes ver todo el detalle del equipo: {link}'. Si no hay selectorQuote, NO inventes modelo ni precio: pedi el dato tecnico que falte y/o ofrece revisar juntos con los 4 datos (profundidad/nivel de agua, altura tanque, diametro perforacion, uso/litros).",
      "GATE DURO: si el cliente abre con un mensaje vago o pide precio ('Precio?', 'Hola', 'Info', 'cuanto sale', un emoji) y NO hay contexto de que producto habla (sin bloque de anuncio con datos, sin equipo/uso mencionado, no viene del selector), NO mandes las 4 preguntas tecnicas ni un rango de precio. Respondé pidiendo que diga que equipo busca o mande una captura de la publi por la que llego. Recien con contexto seguis con el flujo normal.",
      "El mensaje del cliente puede traer al final un bloque entre corchetes con el contexto del anuncio de Meta. Si dice '[Vino de un anuncio de Meta - titulo... texto... link...]', usa esos datos para saber que producto vio y responde sobre ESE equipo (no pidas captura). Si dice '[Vino de un anuncio... pero no llego el contenido del anuncio]', o el cliente abre con algo vago (solo 'Precio?', 'Hola', 'Info', un emoji) sin contexto, no inventes el producto: deci con honestidad que no podes ver la imagen ni donde toco y pedile una captura de la publicacion o que te diga que equipo estaba viendo.",
      "El diametro de la bomba define el modelo: 2\" para perforaciones angostas (~63-80mm), 4\" para perforaciones anchas (110mm+) y mas caudal/riego. La misma potencia puede venir en 2\" y 4\" (ej 500W existe en ambas). Si el cliente llega desde una publi/anuncio que promociona un modelo puntual (ej publi de Facebook de la 4\" 500W), ESE es el modelo que aplica: pasale el link de ese (kit-bomba-solar-4-500w), no el de otro diametro, salvo que sus datos pidan claramente otro.",
      "Si preguntan cuanto tiempo de uso continuo aguantan las bombas o cuantas horas funcionan, responde que estan preparadas para trabajar todo el dia sin problemas: las solares sumergibles son para uso continuo durante las horas de sol, no se recalientan ni se desgastan por trabajar todo el dia. De noche/sin sol no bombean (no usan bateria para operar). Para llenar reservorios o piletas, durante el dia la bomba va llenando; el dato que define el equipo es profundidad y diametro, no las horas.",
      "Si selectorQuote no esta disponible pero falta algun dato tecnico, pedi solo ese dato. No inventes precios ni modelos.",
      "Si selectorQuote.error existe, deriva o pedi disculpas brevemente; no inventes una cotizacion alternativa.",
      "Solo si el cliente ya confirmo que quiere asesor, si pidio compra/cierre/factura/envio/pago, o si el caso requiere solucion a medida, entonces tu respuesta puede decir que lo vas a pasar/derivar y escalar debe ser true.",
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
                history: conversationHistory,
                memoriaComercial: conversationMemory,
                contactoPrevio: contactContext,
                etiquetasDisponibles: labelDefinitions.map((label) => ({
                  slug: label.slug,
                  name: label.name,
                  instructions: label.instructions
                }))
              },
              febecos: {
                profile,
                fallback,
                selectorQuote
              },
              outputSchema: {
                respuesta: "primer mensaje WhatsApp (mensaje 1 de 2 cuando viene de publi: saludo + modelo + link ficha). En el resto de casos, el unico mensaje.",
                segundoMensaje: "segundo mensaje WhatsApp SOLO cuando viene de publi: catalogo + selector + linea de asesoramiento. null en todos los demas casos.",
                sentimiento: "positivo | neutral | preocupado | molesto",
                consultype: allowedConsultypes.join(" | "),
                escalar: "boolean",
                nombre: "nombre detectado o null",
                imagenes: "array de ids/urls de imagenes a enviar, si aplica",
                archivos: "array de ids/urls de archivos a enviar, si aplica",
                action: "none | create_lead | create_ticket | record_event | send_selector_flow",
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
            "segundoMensaje",
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
            segundoMensaje: { type: ["string", "null"] },
            sentimiento: {
              type: "string",
              enum: ["positivo", "neutral", "preocupado", "molesto"]
            },
            consultype: {
              type: "string",
              description: "Slug exacto de una etiqueta activa o tipo base permitido."
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
              enum: ["none", "create_lead", "create_ticket", "record_event", "send_selector_flow"]
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

function buildConversationMemoryContext(memory: ConversationMemory | null) {
  if (!memory) {
    return null;
  }

  return {
    summary: memory.summary,
    technicalFacts: memory.technical_facts,
    commercialFacts: memory.commercial_facts,
    pendingQuestions: memory.pending_questions,
    lastIntent: memory.last_intent,
    lastTopic: memory.last_topic,
    updatedAt: memory.updated_at
  };
}

function buildSelectorCheckoutResult(message: string): AgentResult | null {
  const normalized = normalizeSpanish(message);
  const isSelectorCheckout =
    normalized.includes("consulta desde el selector de febecos") ||
    normalized.includes("quiero comprar el kit") ||
    normalized.includes("complete la evaluacion de bombeo solar en febecos") ||
    normalized.includes("equipo sugerido");

  if (!isSelectorCheckout) {
    return null;
  }

  const equipment = findSelectorField(message, /(?:equipo|equipo sugerido):\*?\s*([^\n]+)/i);
  const price = findSelectorField(message, /(?:precio total|precio equipo full|precio):\*?\s*([^\n]+)/i);
  const installments = findSelectorField(message, /(?:o\s+)?en\s+6\s+cuotas?\s+de:\s*([^\n]+)/i);

  const summaryParts = [
    equipment ? `el equipo ${equipment}` : "el equipo que elegiste en el selector",
    price ? `con precio total ${price}` : null,
    installments ? `y referencia de 6 cuotas de ${installments}` : null
  ].filter(Boolean);
  const isEvaluatingOnly = normalized.includes("solo evaluando");
  const needsCustomAdvisor =
    normalized.includes("solucion a medida") ||
    normalized.includes("multi-bomba") ||
    normalized.includes("multi bomba") ||
    normalized.includes("con tanque") ||
    normalized.includes("me pueden asesorar") ||
    normalized.includes("pueden asesorar") ||
    normalized.includes("stock cubre solo");

  if (needsCustomAdvisor) {
    return {
      respuesta: [
        `Perfecto, recibimos tu seleccion del selector de Febecos. ${summaryParts.join(", ")}.`,
        "Como el caso requiere solucion a medida, ya lo derivamos a un asesor de Febecos para que lo revise bien. Tene en cuenta que la atencion de asesores es de 9 a 19 hs, en horario comercial; te van a contactar en cuanto haya uno disponible."
      ].join("\n\n"),
      segundoMensaje: null,
      sentimiento: "positivo",
      consultype: "caliente",
      escalar: true,
      nombre: null,
      imagenes: [],
      archivos: [],
      action: "create_ticket",
      actionSubject: "solucion a medida desde selector Febecos"
    };
  }

  return {
    respuesta: [
      `Perfecto, recibimos tu seleccion del selector de Febecos. ${summaryParts.join(", ")}.`,
      isEvaluatingOnly
        ? "Si queres avanzar o revisar disponibilidad, forma de pago, envio y factura, te ayudo a coordinarlo."
        : "Queres que te pase con un asesor de Febecos para confirmar disponibilidad, forma de pago, envio y factura?"
    ].join("\n\n"),
    segundoMensaje: null,
    sentimiento: "positivo",
    consultype: "caliente",
    escalar: false,
    nombre: null,
    imagenes: [],
    archivos: [],
    action: "create_ticket",
    actionSubject: "compra desde selector Febecos"
  };
}

function buildFarewellResult(
  message: string,
  history: ReturnType<typeof buildConversationHistory>
): AgentResult | null {
  // Solo aplicar si ya hay historial previo (no es el primer mensaje)
  if (history.length < 2) {
    return null;
  }

  const normalized = normalizeSpanish(message).trim();

  // Los mensajes de despedida son cortos
  if (normalized.length > 100) {
    return null;
  }

  const farewellPatterns = [
    /\bte\s+aviso\b/,
    /\blos\s+aviso\b/,
    /\bya\s+aviso\b/,
    /\bcualquier\s+cosa\s+te\s+(aviso|escribo|llamo|contacto)\b/,
    /\bestamos\s+en\s+contacto\b/,
    /\bquedamos\s+en\s+contacto\b/,
    /\bchau+\b/,
    /\bhasta\s+luego\b/,
    /\bnosv?\s*vemos\b/,
    /\bhasta\s+pronto\b/,
    /^dale[,!\s]*(?:muchas?\s*)?gracias[,!\s.]*(?:saludos)?[.!]*$/,
    /^(?:muchas?\s*)?gracias[,!\s.]*(?:saludos|hasta\s+luego|chau)?[.!]*$/,
    /^saludos[.!]*$/
  ];

  const isFarewell = farewellPatterns.some((pattern) => pattern.test(normalized));

  if (!isFarewell) {
    return null;
  }

  return {
    respuesta: "¡Dale! Acá estamos cuando quieras. 👋",
    segundoMensaje: null,
    sentimiento: "positivo",
    consultype: "seguimiento",
    escalar: false,
    nombre: null,
    imagenes: [],
    archivos: [],
    action: "none",
    actionSubject: null
  };
}

function buildPaymentPreferenceResult(
  message: string,
  history: ReturnType<typeof buildConversationHistory>
): AgentResult | null {
  if (!hasRecentQuote(history)) {
    return null;
  }

  const normalized = normalizeSpanish(message);
  const wantsInstallments =
    /\b(6|seis)\s*cuotas?\b/.test(normalized) ||
    normalized === "ver cuotas" ||
    normalized === "cuotas";
  const wantsCash =
    /\bcontado\b/.test(normalized) ||
    normalized === "cash";

  if (!wantsInstallments && !wantsCash) {
    return null;
  }

  return {
    respuesta: wantsInstallments ?
      "Perfecto, lo vemos en 6 cuotas. Si queres avanzar, podes hablar con un asesor y lo coordinan con vos."
    : "Perfecto, lo vemos de contado. Si queres avanzar, podes hablar con un asesor y lo coordinan con vos.",
    segundoMensaje: null,
    sentimiento: "positivo",
    consultype: "comparador",
    escalar: false,
    nombre: null,
    imagenes: [],
    archivos: [],
    action: "none",
    actionSubject: null
  };
}

function findSelectorField(message: string, pattern: RegExp) {
  return message.match(pattern)?.[1]?.trim() ?? null;
}

function hasRecentQuote(history: ReturnType<typeof buildConversationHistory>) {
  return history
    .slice(-8)
    .some((message) => {
      if (message.speaker !== "febo_ai") {
        return false;
      }

      const text = normalizeSpanish(message.text);
      return text.includes("cuota") || text.includes("contado") || text.includes("precio") || text.includes("$");
    });
}

function normalizeSpanish(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function extractQuoteRequest(input: {
  message: string;
  history: ReturnType<typeof buildConversationHistory>;
  memory: ReturnType<typeof buildConversationMemoryContext>;
}): Promise<QuoteExtraction> {
  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      "Extrae datos para cotizar una bomba solar Febecos desde una conversacion de WhatsApp.",
      "No respondas al cliente. Solo devolve JSON.",
      "Usa memoriaComercial para recuperar datos previos aunque no aparezcan en los ultimos mensajes.",
      "shouldQuote=true si el cliente pide precio/cotizacion/modelo o si ya dio datos suficientes para cotizar.",
      "hasEnoughData=true solo si hay altura/profundidad, consumo diario y diametro maximo de bomba compatible.",
      "Consumo por animal: SOLO para BOVINOS (vacas, terneros, novillos, vaquillonas, hacienda de cria/engorde/tambo) calcula litrosPerDay = animales * 60. Para OTROS animales (chanchos/cerdos, ovejas, cabras, aves/pollos, caballos) NO asumas litros: deja litersPerDay=null y agrega 'litros por dia' a missingData, porque su consumo es distinto al de las vacas y hay que preguntarlo.",
      "Medida ambigua altura vs distancia: si el cliente dice 'X metros al tanque / hasta el tanque / al lugar' y NO aclara si es altura vertical (lo que sube el agua) o distancia horizontal, NO uses esa medida como heightMeters ni como altura de tanque: deja heightMeters sin definir por esa medida y agrega 'confirmar si los X m son altura o distancia' a missingData. La distancia horizontal NO es altura.",
      "Fuente abierta: si el cliente dice que NO tiene perforacion, o que es un lago/laguna/represa/canal/acequia/tajamar/pozo abierto/a cielo abierto, es una FUENTE ABIERTA. La bomba va sumergida dentro de una camisa de PVC y entra cualquier diametro. En ese caso NO exijas diametro de perforacion: usa maxPumpDiameterInches=4 y no lo pongas en missingData por ese motivo.",
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
              historial: input.history,
              memoriaComercial: input.memory
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
  input: {
    message: string;
    history: ReturnType<typeof buildConversationHistory>;
    memory: ReturnType<typeof buildConversationMemoryContext>;
  }
): QuoteExtraction {
  const sourceText = [
    input.memory ? JSON.stringify(input.memory) : "",
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
  // Solo contar como ALTURA de tanque cuando el cliente lo dice explicito
  // (altura/alto/torre). "X m al tanque" a secas es ambiguo (puede ser
  // distancia horizontal) -> no asumir, que el agente pregunte.
  return findMeters(sourceText, [
    /(?:tanque|deposito|depósito|torre)[^.\n]{0,40}?([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)\s*(?:de\s+)?(?:altura|alto)/i,
    /([0-9]+(?:[.,][0-9]+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:m|mts|metros?)\s+(?:de\s+)?(?:altura|alto)\s+(?:al\s+|del\s+|en\s+)?(?:tanque|deposito|depósito|torre)/i
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

    return { status: "ok", inputs: extraction, result: getAgentSafeSelectorResult(result) };
  } catch (error) {
    return {
      status: "error",
      inputs: extraction,
      error: error instanceof Error ? error.message : "No pudimos consultar el motor selector."
    };
  }
}

function getAgentSafeSelectorResult(result: SelectorPumpResult): SelectorPumpResult {
  const suggestion = result.sugerencia;

  return {
    ok: true,
    inputs: result.inputs,
    sugerencia: {
      codigo: suggestion.codigo,
      url_slug: suggestion.url_slug,
      marca: suggestion.marca,
      tipo: suggestion.tipo,
      energia: suggestion.energia,
      impulsor: suggestion.impulsor,
      watts: suggestion.watts,
      cant_paneles: suggestion.cant_paneles,
      watts_panel: suggestion.watts_panel,
      diam_bomba: suggestion.diam_bomba,
      diam_perf: suggestion.diam_perf,
      stock: suggestion.stock,
      precio_full: suggestion.precio_full,
      precio_base: suggestion.precio_base,
      precio_6cuotas: suggestion.precio_6cuotas,
      cuota_mensual: suggestion.cuota_mensual
    },
    caudal_a_altura: result.caudal_a_altura,
    cumple: result.cumple,
    opciones: result.opciones?.slice(0, 3).map((option) => ({
      codigo: option.codigo,
      marca: option.marca,
      watts: option.watts,
      precio_full: option.precio_full,
      stock: option.stock,
      caudal_verano: option.caudal_verano,
      caudal_invierno: option.caudal_invierno,
      cubre_invierno: option.cubre_invierno
    })),
    es_fallback: result.es_fallback,
    cobertura_pct: result.cobertura_pct,
    cobertura_insuficiente: result.cobertura_insuficiente,
    nota: result.nota,
    link_calculadora_roi: result.link_calculadora_roi
  };
}

type SelectorQuote = Awaited<ReturnType<typeof getSelectorQuote>>;

function isInsufficientCoverageQuote(
  quote: SelectorQuote
): quote is Extract<SelectorQuote, { status: "ok" }> {
  return quote.status === "ok" && quote.result.cobertura_insuficiente === true;
}

function buildInsufficientCoverageResult(quote: Extract<SelectorQuote, { status: "ok" }>): AgentResult {
  const coverage = formatCoverage(quote.result.cobertura_pct);

  return {
    respuesta: [
      "Con esos datos, lo que figura en catalogo no llega a cubrir bien el caudal que necesitas.",
      coverage ? `El equipo mas cercano cubre aprox. ${coverage} del consumo pedido, asi que no te quiero pasar una cotizacion incorrecta.` : "No te quiero pasar una cotizacion incorrecta.",
      "Te paso a un asesor de Febecos para armarlo a medida y que quede bien resuelto."
    ].join("\n\n"),
    segundoMensaje: null,
    sentimiento: "neutral",
    consultype: "caliente",
    escalar: true,
    nombre: null,
    imagenes: [],
    archivos: [],
    action: "create_ticket",
    actionSubject: "cotizacion a medida por cobertura insuficiente"
  };
}

function formatCoverage(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return `${Math.round(value)}%`;
}

export async function refreshConversationMemory(conversationId: string | null | undefined) {
  if (!conversationId) {
    return;
  }

  const previousMemory = await getConversationMemory(conversationId);
  const history = await listAgentConversationContext(conversationId, 80);

  if (!history.length) {
    return;
  }

  const response = await getOpenAI().responses.create({
    model: config.OPENAI_MODEL,
    instructions: [
      "Actualiza la memoria comercial persistente de una conversacion de WhatsApp de Febecos.",
      "La memoria debe conservar datos importantes aunque no aparezcan en el ultimo mensaje.",
      "No inventes datos tecnicos, precios, stock, cuotas ni nombres. Si un dato no esta, usa null.",
      "Si hay una cotizacion anterior, equipo sugerido, zona, litros, altura, diametro, forma de pago, asesor o pendiente comercial, conservalo.",
      "Si el cliente cambia de tema, no borres el caso anterior: resumilo y marca lastTopic con el tema actual.",
      "pendingQuestions debe incluir solo preguntas o datos realmente pendientes para avanzar.",
      "Devolve exclusivamente JSON valido con el esquema pedido."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              memoriaAnterior: previousMemory ? buildConversationMemoryContext(previousMemory) : null,
              mensajesRecientes: buildConversationHistory(history)
            })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "febo_conversation_memory",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "technicalFacts", "commercialFacts", "pendingQuestions", "lastIntent", "lastTopic"],
          properties: {
            summary: { type: "string" },
            technicalFacts: {
              type: "object",
              additionalProperties: false,
              required: [
                "zona",
                "uso",
                "litrosDia",
                "alturaTotal",
                "profundidadPozo",
                "nivelAgua",
                "alturaTanque",
                "distanciaHorizontal",
                "diametro",
                "equipoSugerido",
                "precio",
                "cuotas",
                "stock",
                "selectorOrigen",
                "notasTecnicas"
              ],
              properties: nullableStringProperties([
                "zona",
                "uso",
                "litrosDia",
                "alturaTotal",
                "profundidadPozo",
                "nivelAgua",
                "alturaTanque",
                "distanciaHorizontal",
                "diametro",
                "equipoSugerido",
                "precio",
                "cuotas",
                "stock",
                "selectorOrigen",
                "notasTecnicas"
              ])
            },
            commercialFacts: {
              type: "object",
              additionalProperties: false,
              required: [
                "estadoCompra",
                "intencion",
                "asesorAsignado",
                "presupuestoEnviado",
                "formaPago",
                "envioFactura",
                "objeciones",
                "proximoPaso"
              ],
              properties: nullableStringProperties([
                "estadoCompra",
                "intencion",
                "asesorAsignado",
                "presupuestoEnviado",
                "formaPago",
                "envioFactura",
                "objeciones",
                "proximoPaso"
              ])
            },
            pendingQuestions: { type: "array", items: { type: "string" } },
            lastIntent: { type: ["string", "null"] },
            lastTopic: { type: ["string", "null"] }
          }
        },
        strict: true
      }
    }
  });

  const memory = memorySchema.parse(JSON.parse(normalizeJson(response.output_text)));
  await saveConversationMemory(conversationId, memory);
}

function nullableStringProperties(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, { type: ["string", "null"] }]));
}

async function saveConversationMemory(conversationId: string, memory: ConversationMemoryUpdate) {
  await upsertConversationMemory({
    conversationId,
    summary: memory.summary,
    technicalFacts: memory.technicalFacts,
    commercialFacts: memory.commercialFacts,
    pendingQuestions: memory.pendingQuestions,
    lastIntent: memory.lastIntent,
    lastTopic: memory.lastTopic
  });
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
