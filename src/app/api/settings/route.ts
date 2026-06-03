import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listAppSettings, upsertAppSetting } from "@/lib/crm";

const notificationSoundSchema = z.object({
  sound: z.enum(["chime", "ping", "soft", "alert", "none"]),
  volume: z.number().min(0).max(1)
});

const userNotificationSoundSchema = z.object({
  mode: z.enum(["default", "custom"]),
  sound: z.enum(["chime", "ping", "soft", "alert", "none"]).optional(),
  volume: z.number().min(0).max(1).optional()
});

const settingSchema = z.object({
  key: z.enum([
    "auto_reply_delay_seconds",
    "hot_lead_default_assignee_id",
    "notification_sound",
    "notification_sound_users",
    "whatsapp_selector_flow_id",
    "whatsapp_selector_flow_screen",
    "whatsapp_selector_flow_header",
    "whatsapp_selector_flow_body",
    "whatsapp_selector_flow_footer",
    "whatsapp_selector_flow_cta"
  ]),
  value: z.union([z.string(), z.number(), z.null(), notificationSoundSchema, z.record(z.string(), userNotificationSoundSchema)])
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

  let value:
    | string
    | number
    | null
    | z.infer<typeof notificationSoundSchema>
    | Record<string, z.infer<typeof userNotificationSoundSchema>> = parsed.data.value;

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

  if (parsed.data.key === "notification_sound") {
    const sound = notificationSoundSchema.safeParse(value);

    if (!sound.success) {
      return NextResponse.json({ error: "Configuracion de sonido invalida." }, { status: 400 });
    }

    value = {
      sound: sound.data.sound,
      volume: Math.round(sound.data.volume * 100) / 100
    };
  }

  if (parsed.data.key === "notification_sound_users") {
    const soundUsers = z.record(z.string(), userNotificationSoundSchema).safeParse(value);

    if (!soundUsers.success) {
      return NextResponse.json({ error: "Configuracion de sonidos por usuario invalida." }, { status: 400 });
    }

    value = Object.fromEntries(
      Object.entries(soundUsers.data).map(([userId, setting]) => [
        userId,
        setting.mode === "custom"
          ? {
              mode: "custom",
              sound: setting.sound ?? "chime",
              volume: Math.round((setting.volume ?? 0.55) * 100) / 100
            }
          : { mode: "default" }
      ])
    ) as Record<string, z.infer<typeof userNotificationSoundSchema>>;
  }

  if (parsed.data.key.startsWith("whatsapp_selector_flow_")) {
    value = String(value ?? "").trim();

    if (!value) {
      return NextResponse.json({ error: "El valor no puede quedar vacio." }, { status: 400 });
    }

    if (String(value).length > 700) {
      return NextResponse.json({ error: "El texto es demasiado largo para esta configuracion." }, { status: 400 });
    }
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
