import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listDueFollowUpsForAssignedUser } from "@/lib/crm";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    followUps: await listDueFollowUpsForAssignedUser(user.id)
  });
}
