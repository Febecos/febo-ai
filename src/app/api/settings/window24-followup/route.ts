import { type NextRequest, NextResponse } from "next/server";
import { getSettingValue, upsertAppSetting } from "@/lib/crm";
import { getCurrentUser } from "@/lib/auth";

const SETTING_KEY = "window24_followup";

const DEFAULT_CONFIG = {
  delayHours: 21,
  text: "Hola! 👋 Te escribimos desde Febecos. ¿Pudiste ver los datos del equipo que te compartimos? Si tenés alguna duda o querés que un asesor te ayude a elegir la bomba solar ideal para tu campo, estamos por acá. 😊",
  enabled: true,
  consultype: "lead-publi"
};

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const cfg = await getSettingValue(SETTING_KEY, DEFAULT_CONFIG);
  return NextResponse.json({ config: cfg });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json() as { delayHours?: number; text?: string; enabled?: boolean };
  const current = await getSettingValue(SETTING_KEY, DEFAULT_CONFIG);

  const updated = {
    ...current,
    ...(typeof body.delayHours === "number" ? { delayHours: Math.min(23, Math.max(1, body.delayHours)) } : {}),
    ...(typeof body.text === "string" && body.text.trim() ? { text: body.text.trim() } : {}),
    ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {})
  };

  await upsertAppSetting({
    key: SETTING_KEY,
    value: updated,
    label: "Seguimiento ventana 24hs",
    description: "Mensaje automático para leads publi sin respuesta dentro de la ventana de 24hs"
  });

  return NextResponse.json({ ok: true, config: updated });
}
