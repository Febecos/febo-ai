import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createManualConversationEvent, listConversationEvents } from "@/lib/crm";

const schema = z.object({
  conversationId: z.string().uuid()
});

const manualEventSchema = schema.extend({
  event: z.enum(["manual_selector_febecos", "manual_purchase", "manual_lead"])
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = schema.safeParse({
    conversationId: request.nextUrl.searchParams.get("conversationId")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Conversacion invalida." }, { status: 400 });
  }

  return NextResponse.json({
    events: await listConversationEvents(parsed.data.conversationId)
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = manualEventSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Evento invalido." }, { status: 400 });
  }

  const event = await createManualConversationEvent({
    conversationId: parsed.data.conversationId,
    event: parsed.data.event,
    actorUserId: user.id,
    actorName: user.full_name
  });

  if (!event) {
    return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    event,
    events: await listConversationEvents(parsed.data.conversationId)
  });
}
