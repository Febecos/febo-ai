import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelScheduledTemplateMessage, listScheduledTemplateMessages } from "@/lib/crm";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    scheduled: await listScheduledTemplateMessages({
      createdBy: user.role === "admin" ? undefined : user.id,
      limit: 150
    })
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Falta el envio programado." }, { status: 400 });
  }

  const cancelled = await cancelScheduledTemplateMessage({ id, user });

  if (!cancelled) {
    return NextResponse.json({ error: "No se pudo eliminar. Puede que ya se haya enviado." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    scheduled: await listScheduledTemplateMessages({
      createdBy: user.role === "admin" ? undefined : user.id,
      limit: 150
    })
  });
}
