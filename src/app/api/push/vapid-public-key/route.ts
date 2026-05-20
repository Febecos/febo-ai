import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey()
  });
}
