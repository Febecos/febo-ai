import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createConversationNote, listConversations, updateConversation } from "@/lib/crm";

const updateSchema = z.object({
  conversationId: z.string().uuid(),
  status: z.string().optional(),
  aiEnabled: z.boolean().optional(),
  unread: z.boolean().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  consultype: z.string().optional(),
  displayName: z.string().nullable().optional()
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams;
  const assignedTo = search.get("assignedTo") ?? undefined;

  return NextResponse.json({
    conversations: await listConversations({
      query: search.get("q") ?? undefined,
      consultype: search.get("consultype") ?? undefined,
      status: search.get("status") ?? undefined,
      assignedTo: assignedTo === "mine" ? user.id : assignedTo,
      limit: Number(search.get("limit") ?? 300)
    })
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const result = await updateConversation(parsed.data);

  if (parsed.data.assignedTo !== undefined && result?.assignedChanged) {
    const assignee = result.assignedName ? ` a ${result.assignedName}` : " sin asignar";
    await createConversationNote({
      conversationId: parsed.data.conversationId,
      userId: user.id,
      body: `${user.full_name} transfirio la conversacion${assignee}.`
    });
  }

  return NextResponse.json({ ok: true });
}
