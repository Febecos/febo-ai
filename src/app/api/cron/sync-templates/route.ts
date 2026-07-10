import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { isDbConfigured } from "@/lib/db";
import { listMessageTemplates, upsertMessageTemplates } from "@/lib/crm";
import { fetchWhatsAppMessageTemplates } from "@/lib/whatsapp";

export const maxDuration = 60;

// Sincroniza el estado de las plantillas de WhatsApp desde Meta (Graph API) hacia nuestra
// tabla local, la misma lógica que el botón manual "Sincronizar Meta" (/api/templates/sync).
// Motivo (08/07): Guille crea/aprueba plantillas directo en WhatsApp Manager y no aparecían
// en el desplegable de "Enviar plantilla inicial" hasta tocar el botón a mano. Este cron corre
// solo (cada 2hs) para que una plantilla recién aprobada por Meta esté disponible sin depender
// de que alguien recuerde sincronizar manualmente.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "DB no configurada." });
  }

  try {
    const metaTemplates = await fetchWhatsAppMessageTemplates();
    await upsertMessageTemplates(metaTemplates);
    const templates = await listMessageTemplates();
    return NextResponse.json({
      ok: true,
      imported: metaTemplates.length,
      activas: templates.filter((t) => t.active).length
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

function isAuthorizedCronRequest(request: NextRequest) {
  if (!config.CRON_SECRET) {
    return process.env.VERCEL_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${config.CRON_SECRET}`;
}
