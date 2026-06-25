import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// ARCA/AFIP a veces tarda >8s (consulta padrón). Damos margen para no cortar con 502.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const cuit = request.nextUrl.searchParams.get("cuit")?.replace(/\D/g, "");
  if (!cuit || cuit.length !== 11) {
    return NextResponse.json({ error: "CUIT inválido (debe tener 11 dígitos)." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://febecos.com/api/admin?action=consultar_cuit&cuit=${cuit}`,
      { signal: AbortSignal.timeout(25000) }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "ARCA no respondió. Verificá el CUIT." }, { status: 502 });
    }

    const data = await res.json() as Record<string, unknown>;

    if (!data?.ok || data?.valido === false) {
      return NextResponse.json({ error: data?.error as string || "CUIT no encontrado en ARCA." }, { status: 404 });
    }

    const dom = (data.domicilio ?? {}) as Record<string, string>;

    return NextResponse.json({
      cuit,
      razonSocial: data.razonSocial ?? data.denominacion ?? null,
      domicilio: dom.direccion ?? null,
      codigoPostal: dom.codPostal ?? null,
      localidad: dom.localidad ?? null,
      provincia: dom.provincia ?? null,
      tipoPersona: data.tipoPersona ?? null,
      estado: data.estado ?? null,
      condicionFiscal: data.condicionFiscal ?? null
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const msg = isTimeout
      ? "ARCA tardó demasiado en responder. Probá de nuevo en unos segundos."
      : `No pudimos consultar ARCA: ${err instanceof Error ? err.message : "Error desconocido"}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
