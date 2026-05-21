import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { deleteQuickReply, listQuickReplies, upsertQuickReply } from "@/lib/crm";

const quickReplySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  shortcut: z.string().trim().min(2).max(60),
  availability: z.string().trim().min(2).max(40).default("global"),
  body: z.string().trim().min(1).max(3000)
});

const deleteSchema = z.object({
  id: z.string().uuid()
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({ quickReplies: await listQuickReplies() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = quickReplySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de respuesta rapida invalidos." }, { status: 400 });
  }

  await upsertQuickReply({ ...parsed.data, userId: user.id });

  return NextResponse.json({
    ok: true,
    quickReplies: await listQuickReplies()
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Respuesta rapida invalida." }, { status: 400 });
  }

  await deleteQuickReply(parsed.data.id);

  return NextResponse.json({
    ok: true,
    quickReplies: await listQuickReplies()
  });
}
