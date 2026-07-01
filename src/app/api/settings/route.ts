import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listAppSettings, upsertAppSetting } from "@/lib/crm";
import { sanitizeAiReplySchedule } from "@/lib/ai-schedule";

const notificationSoundSchema = z.object({
  sound: z.enum(["chime", "ping", "soft", "alert", "none"]),
  volume: z.number().min(0).max(1)
});

const userNotificationSoundSchema = z.object({
  mode: z.enum(["default", "custom"]),
  sound: z.enum(["chime", "ping", "soft", "alert", "none"]).optional(),
  volume: z.number().min(0).max(1).optional()
});

const scheduleDaySchema = z.object({
  mode: z.enum(["ai_all", "humans_all", "humans_window", "ai_window"]),
  from: z.string().optional(),
  to: z.string().optional()
});
const scheduleSchema = z.object({
  enabled: z.boolean(),
  tz: z.string().optional(),
  days: z.record(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]), scheduleDaySchema)
});

const settingSchema = z.object({
  key: z.enum([
    "ai_auto_reply_enabled",
    "ai_reply_schedule",
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
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), notificationSoundSchema, scheduleSchema, z.record(z.string(), userNotificationSoundSchema)])
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
    | boolean
    | null
    | z.infer<typeof notificationSoundSchema>
    | z.infer<typeof scheduleSchema>
    | Record<string, z.infer<typeof userNotificationSoundSchema>> = parsed.data.value;

  // Interruptor global de respuestas automáticas de la IA (para pruebas manuales).
  if (parsed.data.key === "ai_auto_reply_enabled") {
    value = value === true || value === "true" || value === 1;
  }

  // Horario semanal de la IA: saneamos a una estructura válida antes de persistir.
  if (parsed.data.key === "ai_reply_schedule") {
    value = sanitizeAiReplySchedule(value);
  }

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
