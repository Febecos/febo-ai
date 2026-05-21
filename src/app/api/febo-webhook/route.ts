import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { recordSelectorCheckoutLead } from "@/lib/crm";
import { sendPushNotificationToAll } from "@/lib/push";

const checkoutSchema = z.object({
  origen: z.literal("selector"),
  evento: z.literal("checkout_abierto"),
  tipo_kit: z.enum(["base", "completo"]),
  codigo: z.string().min(2),
  marca: z.string().nullable().optional(),
  watts: z.number().nullable().optional(),
  precio_total: z.number().positive(),
  precio_base_kit: z.number().nullable().optional(),
  extra_cable: z.number().nullable().optional(),
  cuota_mensual: z.number().nullable().optional(),
  cuotas_cant: z.number().int().positive().nullable().optional(),
  metros_cable: z.number().nullable().optional(),
  metros_soga: z.number().nullable().optional(),
  metros_sensor: z.number().nullable().optional(),
  zona: z.string().nullable().optional(),
  altura: z.number().nullable().optional(),
  litros: z.number().nullable().optional(),
  diametro: z.number().nullable().optional(),
  whatsapp_cliente: z.string().min(6),
  timestamp: z.string().nullable().optional()
});

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = checkoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await recordSelectorCheckoutLead(parsed.data);

  if (!result.duplicate) {
    await sendPushNotificationToAll({
      title: "Nuevo checkout del selector",
      body: `${parsed.data.codigo} - ${formatARS(parsed.data.precio_total)}`,
      url: "/"
    });
  }

  return NextResponse.json({ ok: true, duplicate: result.duplicate, conversationId: result.threadId });
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
