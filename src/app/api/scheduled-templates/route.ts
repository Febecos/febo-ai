import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listScheduledTemplateMessages } from "@/lib/crm";

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
