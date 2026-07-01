/**
 * Horario semanal de respuestas automáticas de la IA (OBJETIVO: atención humana por franja).
 * Idea: en el horario en que el equipo está conectado, la IA se PAUSA (atienden ellos);
 * fuera de ese horario, la IA responde sola. Configurable por día (lunes a domingo).
 *
 * Convive con el interruptor global `ai_auto_reply_enabled`:
 *   - master OFF  → la IA nunca responde (pausa total, para pruebas). El horario no importa.
 *   - master ON   → si el horario está `enabled`, decide según día+hora actual (zona AR).
 *
 * Zona horaria por defecto: America/Argentina/Buenos_Aires.
 */

export type DayMode = "ai_all" | "humans_all" | "humans_window" | "ai_window";

export type DaySchedule = {
  mode: DayMode;
  from?: string; // "HH:MM" (para *_window)
  to?: string;   // "HH:MM"
};

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type AiReplySchedule = {
  enabled: boolean;
  tz?: string;
  days: Partial<Record<DayKey, DaySchedule>>;
};

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado", sun: "Domingo"
};

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

// Default: horario desactivado + todos los días con IA todo el día (no cambia nada hasta configurar).
export function defaultAiReplySchedule(): AiReplySchedule {
  return {
    enabled: false,
    tz: DEFAULT_TZ,
    days: Object.fromEntries(DAY_KEYS.map((d) => [d, { mode: "ai_all" as DayMode }]))
  };
}

function hhmmToMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

// ¿`cur` (minutos) cae dentro de [from,to)? Soporta ventana que cruza medianoche (from>to).
function withinWindow(cur: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}

// Día+hora actual en la zona configurada.
function nowParts(tz: string, now: Date): { dayKey: DayKey; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit"
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, DayKey> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };
  return { dayKey: map[wd] ?? "mon", minutes: (hour % 24) * 60 + (minute % 60) };
}

/**
 * ¿La IA debe responder AHORA según el horario? true = responde, false = pausa (atención humana).
 * Si el horario está desactivado o mal configurado, NO bloquea (devuelve true).
 */
export function aiShouldReplyNow(schedule: AiReplySchedule | null | undefined, now: Date = new Date()): boolean {
  if (!schedule || !schedule.enabled || !schedule.days) return true;
  const tz = schedule.tz || DEFAULT_TZ;
  let cur: { dayKey: DayKey; minutes: number };
  try {
    cur = nowParts(tz, now);
  } catch {
    return true; // tz inválida → no bloquear
  }
  const day = schedule.days[cur.dayKey];
  if (!day) return true;

  switch (day.mode) {
    case "humans_all":
      return false; // atienden ellos todo el día
    case "ai_all":
      return true;
    case "humans_window": {
      const from = hhmmToMinutes(day.from);
      const to = hhmmToMinutes(day.to);
      if (from == null || to == null) return true;
      // IA en pausa DENTRO de la franja (ellos atienden), responde FUERA.
      return !withinWindow(cur.minutes, from, to);
    }
    case "ai_window": {
      const from = hhmmToMinutes(day.from);
      const to = hhmmToMinutes(day.to);
      if (from == null || to == null) return true;
      // IA responde SOLO dentro de la franja.
      return withinWindow(cur.minutes, from, to);
    }
    default:
      return true;
  }
}

// Sanea un objeto arbitrario a un AiReplySchedule válido (para el POST de settings).
export function sanitizeAiReplySchedule(input: unknown): AiReplySchedule {
  const base = defaultAiReplySchedule();
  if (!input || typeof input !== "object") return base;
  const obj = input as Record<string, unknown>;
  const out: AiReplySchedule = { enabled: obj.enabled === true, tz: DEFAULT_TZ, days: {} };
  const days = (obj.days && typeof obj.days === "object" ? obj.days : {}) as Record<string, unknown>;
  for (const d of DAY_KEYS) {
    const raw = days[d] as Record<string, unknown> | undefined;
    const mode = raw?.mode as DayMode | undefined;
    const validMode: DayMode = mode === "humans_all" || mode === "humans_window" || mode === "ai_window" ? mode : "ai_all";
    const day: DaySchedule = { mode: validMode };
    if (validMode === "humans_window" || validMode === "ai_window") {
      day.from = typeof raw?.from === "string" && hhmmToMinutes(raw.from) != null ? raw.from : "09:00";
      day.to = typeof raw?.to === "string" && hhmmToMinutes(raw.to) != null ? raw.to : "18:00";
    }
    out.days[d] = day;
  }
  return out;
}
