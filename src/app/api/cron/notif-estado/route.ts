import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { config } from "@/lib/config";
import { consumirPedidoEstadoCambiado } from "@/lib/notificaciones";

export const maxDuration = 60;

// CONSUMIDOR C1 (OBJETIVO-99): avisa por WhatsApp el cambio de estado del pedido.
// Consume `pedido.estado_cambiado` del bus central y rutea según el contrato de
// notificaciones (Regla A): WA si hay conversación activa, registra en `notificaciones`
// para que Envíos haga SKIP del email. Aditivo y reversible.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "DB no configurada." });
  }

  try {
    const out = await consumirPedidoEstadoCambiado();
    return NextResponse.json(out);
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
