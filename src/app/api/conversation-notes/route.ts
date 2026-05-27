import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createConversationNote, listConversationNotes } from "@/lib/crm";

const schema = z.object({
  conversationId: z.string().uuid()
});

const createSchema = schema.extend({
  body: z.string().trim().min(1).max(2000)
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
    notes: await listConversationNotes(parsed.data.conversationId)
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Nota invalida." }, { status: 400 });
  }

  await createConversationNote({
    conversationId: parsed.data.conversationId,
    userId:   user.id,
    body:     parsed.data.body,
    userName: user.full_name ?? user.email ?? null,
    source:   "febo",
  });

  return NextResponse.json({
    ok: true,
    notes: await listConversationNotes(parsed.data.conversationId)
  });
}
