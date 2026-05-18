import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listConversations, updateConversation } from "@/lib/crm";

const updateSchema = z.object({
  conversationId: z.string().uuid(),
  status: z.string().optional(),
  aiEnabled: z.boolean().optional(),
  assignedTo: z.string().uuid().nullable().optional()
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
      limit: Number(search.get("limit") ?? 80)
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

  await updateConversation(parsed.data);
  return NextResponse.json({ ok: true });
}
