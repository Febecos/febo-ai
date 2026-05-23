import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listAppSettings, upsertAppSetting } from "@/lib/crm";

const settingSchema = z.object({
  key: z.enum(["auto_reply_delay_seconds", "hot_lead_default_assignee_id"]),
  value: z.union([z.string(), z.number(), z.null()])
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    settings: await listAppSettings()
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = settingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Configuracion invalida." }, { status: 400 });
  }

  let value: string | number | null = parsed.data.value;

  if (parsed.data.key === "auto_reply_delay_seconds") {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 900) {
      return NextResponse.json({ error: "La demora debe estar entre 0 y 900 segundos." }, { status: 400 });
    }

    value = Math.round(numericValue);
  }

  if (parsed.data.key === "hot_lead_default_assignee_id" && value === "") {
    value = null;
  }

  await upsertAppSetting({
    key: parsed.data.key,
    value
  });

  return NextResponse.json({
    ok: true,
    settings: await listAppSettings()
  });
}
