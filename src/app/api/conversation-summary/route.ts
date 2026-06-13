import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConversationMemory } from "@/lib/crm";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId requerido." }, { status: 400 });

  const memory = await getConversationMemory(conversationId);
  if (!memory) return NextResponse.json({ memory: null });

  return NextResponse.json({ memory });
}
