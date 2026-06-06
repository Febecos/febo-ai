import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { distillLearnings } from "@/lib/learnings";

export const maxDuration = 120;

function isAuthorizedCronRequest(request: NextRequest) {
  if (!config.CRON_SECRET) {
    return process.env.VERCEL_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${config.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await distillLearnings(30);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos destilar aprendizajes.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
