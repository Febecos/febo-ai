import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteOutgoingWebhook,
  listOutgoingWebhookDeliveries,
  listOutgoingWebhooks,
  testOutgoingWebhook,
  upsertOutgoingWebhook
} from "@/lib/crm";

const events = [
  "selector_checkout_abierto",
  "lead_caliente",
  "asesor_asignado",
  "chat_escalado",
  "mensaje_entrante",
  "mensaje_saliente",
  "follow_up_proposed",
  "presupuesto_enviado",
  "venta_cerrada",
  "*"
] as const;

const upsertSchema = z.object({
  action: z.literal("upsert"),
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url().max(500),
  secret: z.string().max(200).optional(),
  keepSecret: z.boolean().optional(),
  events: z.array(z.enum(events)).min(1).max(events.length),
  active: z.boolean()
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().uuid()
});

const testSchema = z.object({
  action: z.literal("test"),
  id: z.string().uuid()
});

const requestSchema = z.discriminatedUnion("action", [upsertSchema, deleteSchema, testSchema]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    webhooks: await listOutgoingWebhooks(),
    deliveries: await listOutgoingWebhookDeliveries(30),
    availableEvents: events
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Webhook invalido." }, { status: 400 });
  }

  if (parsed.data.action === "delete") {
    await deleteOutgoingWebhook(parsed.data.id);
  }

  if (parsed.data.action === "test") {
    await testOutgoingWebhook(parsed.data.id, user.id);
  }

  if (parsed.data.action === "upsert") {
    await upsertOutgoingWebhook({
      id: parsed.data.id,
      name: parsed.data.name,
      url: parsed.data.url,
      secret: parsed.data.secret,
      keepSecret: parsed.data.keepSecret,
      events: parsed.data.events,
      active: parsed.data.active,
      actorUserId: user.id
    });
  }

  return NextResponse.json({
    ok: true,
    webhooks: await listOutgoingWebhooks(),
    deliveries: await listOutgoingWebhookDeliveries(30),
    availableEvents: events
  });
}
