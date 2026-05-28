import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  createConversationFollowUp,
  listConversationFollowUps,
  updateConversationFollowUpStatus
} from "@/lib/crm";

const schema = z.object({
  conversationId: z.string().uuid()
});

const createSchema = schema.extend({
  dueAt: z.string().datetime(),
  reason: z.string().trim().min(1).max(500)
});

const updateSchema = schema.extend({
  id: z.string().uuid(),
  status: z.enum(["pending", "sent", "cancelled"])
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
    followUps: await listConversationFollowUps(parsed.data.conversationId)
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Seguimiento invalido." }, { status: 400 });
  }

  const dueAt = new Date(parsed.data.dueAt);

  if (Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "Fecha invalida." }, { status: 400 });
  }

  await createConversationFollowUp({
    conversationId: parsed.data.conversationId,
    dueAt,
    reason: parsed.data.reason,
    source: "manual",
    userId: user.id
  });

  return NextResponse.json({
    ok: true,
    followUps: await listConversationFollowUps(parsed.data.conversationId)
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Seguimiento invalido." }, { status: 400 });
  }

  await updateConversationFollowUpStatus({
    conversationId: parsed.data.conversationId,
    id: parsed.data.id,
    status: parsed.data.status,
    userId: user.id
  });

  return NextResponse.json({
    ok: true,
    followUps: await listConversationFollowUps(parsed.data.conversationId)
  });
}
