import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import {
  normalizeWhatsAppRecipient,
  recordAgentReply,
  recordSelectorCheckoutLead,
  recordSelectorWhatsAppClick
} from "@/lib/crm";
import { sendPushNotificationToAll } from "@/lib/push";
import { sendWhatsAppText } from "@/lib/whatsapp";

const nullableNumber = z.coerce.number().nullable().optional();
const optionalTestFlag = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return ["1", "true", "si", "sí", "yes"].includes(value.trim().toLowerCase());
  }

  return value;
}, z.boolean().optional());

const checkoutSchema = z.object({
  origen: z.literal("selector"),
  evento: z.literal("checkout_abierto"),
  tipo_kit: z.enum(["base", "completo"]),
  codigo: z.string().min(2),
  url_slug: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  watts: nullableNumber,
  precio_total: z.coerce.number().positive(),
  precio_base_kit: nullableNumber,
  extra_cable: nullableNumber,
  cuota_mensual: nullableNumber,
  cuotas_cant: z.coerce.number().int().positive().nullable().optional(),
  metros_cable: nullableNumber,
  metros_soga: nullableNumber,
  metros_sensor: nullableNumber,
  zona: z.string().nullable().optional(),
  altura: nullableNumber,
  litros: nullableNumber,
  diametro: nullableNumber,
  whatsapp_cliente: z.string().min(6),
  timestamp: z.string().nullable().optional(),
  _es_test: optionalTestFlag
}).passthrough();

const whatsappClickSchema = z.object({
  origen: z.literal("selector"),
  evento: z.enum(["whatsapp_click", "wa_click", "whatsapp_abierto"]),
  whatsapp_cliente: z.string().min(6),
  nombre: z.string().nullable().optional(),
  zona: z.string().nullable().optional(),
  lead_id: z.string().nullable().optional(),
  consulta_id: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  timestamp: z.string().nullable().optional(),
  _es_test: optionalTestFlag
}).passthrough();

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const clickParsed = whatsappClickSchema.safeParse(payload);
  if (clickParsed.success) {
    if (clickParsed.data._es_test) {
      return NextResponse.json({ ok: true, test: true, processed: false });
    }

    try {
      const result = await recordSelectorWhatsAppClick(clickParsed.data);
      return NextResponse.json({ ok: true, event: "selector_whatsapp_click", duplicate: result.duplicate, conversationId: result.threadId });
    } catch (error) {
      console.error("No pudimos procesar el click de WhatsApp del selector.", error);
      return NextResponse.json({ ok: false, error: "No pudimos procesar el click de WhatsApp." }, { status: 500 });
    }
  }

  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Payload invalido.",
      issues: {
        checkout: parsed.error.flatten(),
        whatsappClick: clickParsed.error.flatten()
      }
    }, { status: 400 });
  }

  if (parsed.data._es_test) {
    return NextResponse.json({ ok: true, test: true, processed: false });
  }

  try {
    const result = await recordSelectorCheckoutLead(parsed.data);

    if (!result.duplicate) {
      await notifyOperators(parsed.data);
      await confirmSelectorCheckoutToClient(parsed.data, result);
    }

    return NextResponse.json({ ok: true, duplicate: result.duplicate, conversationId: result.threadId });
  } catch (error) {
    console.error("No pudimos procesar el webhook del selector.", error);
    return NextResponse.json({ ok: false, error: "No pudimos procesar el webhook." }, { status: 500 });
  }
}

async function notifyOperators(input: z.infer<typeof checkoutSchema>) {
  try {
    await sendPushNotificationToAll({
      title: "Nuevo checkout del selector",
      body: `${input.codigo} - ${formatARS(input.precio_total)}`,
      url: "/"
    });
  } catch (error) {
    console.error("No pudimos enviar push del checkout del selector.", error);
  }
}

async function confirmSelectorCheckoutToClient(
  input: z.infer<typeof checkoutSchema>,
  result: { contactId: string | null; threadId: string | null }
) {
  const answer = buildSelectorCheckoutConfirmation(input);

  try {
    const sent = await sendWhatsAppText(normalizeWhatsAppRecipient(input.whatsapp_cliente), answer);
    await recordAgentReply({
      contactId: result.contactId,
      threadId: result.threadId,
      answer,
      intent: "caliente",
      needsHuman: true,
      waMessageId: getSentMessageId(sent),
      createHandoff: false
    });
  } catch (error) {
    console.error("No pudimos confirmar el checkout del selector al cliente.", error);
  }
}

function buildSelectorCheckoutConfirmation(input: z.infer<typeof checkoutSchema>) {
  const equipment = `${input.codigo}${input.marca ? ` - ${input.marca}` : ""}`;

  return [
    "Perfecto, recibimos tu seleccion del selector de Febecos.",
    `Equipo: ${equipment}`,
    `Precio total: ${formatARS(input.precio_total)}`,
    "Te paso con un asesor de Febecos para confirmar disponibilidad, forma de pago, envio y factura. Te escribe en breve."
  ].join("\n");
}

function isAuthorized(request: NextRequest) {
  if (!config.FEBECOS_WEBHOOK_TOKEN) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearer ?? request.headers.get("x-febecos-webhook-token");

  return token === config.FEBECOS_WEBHOOK_TOKEN;
}

function formatARS(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

function getSentMessageId(response: unknown) {
  const maybeResponse = response as { messages?: Array<{ id?: string }> };
  return maybeResponse.messages?.[0]?.id ?? null;
}
