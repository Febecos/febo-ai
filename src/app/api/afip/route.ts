import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const cuit = request.nextUrl.searchParams.get("cuit")?.replace(/\D/g, "");
  if (!cuit || cuit.length !== 11) {
    return NextResponse.json({ error: "CUIT inválido (debe tener 11 dígitos)." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://afip.tangofactura.com/Rest/GetContribuyenteFull?cuit=${cuit}`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "ARCA no respondió. Verificá el CUIT." }, { status: 502 });
    }

    const data = await res.json() as Record<string, unknown>;

    if (!data || data.errorGetData) {
      return NextResponse.json({ error: "CUIT no encontrado en ARCA." }, { status: 404 });
    }

    const contrib = (data.Contribuyente ?? data.contribuyente ?? data) as Record<string, unknown>;
    const domicilio = contrib.domicilio as Record<string, unknown> | undefined ??
                      (Array.isArray(contrib.domicilios) ? (contrib.domicilios as Record<string, unknown>[])[0] : null) ?? {};

    return NextResponse.json({
      cuit,
      razonSocial: contrib.razonSocial ?? contrib.apellidoNombre ?? null,
      domicilio: [domicilio.direccion ?? domicilio.calle, domicilio.numero].filter(Boolean).join(" ") || null,
      codigoPostal: domicilio.codigoPostal ?? domicilio.cp ?? null,
      localidad: domicilio.localidad ?? domicilio.descripcionLocalidad ?? null,
      provincia: domicilio.descripcionProvincia ?? domicilio.provincia ?? null,
      categoriaIva: contrib.categoriaIva ?? contrib.descripcionTipoResponsable ?? null,
      raw: contrib
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `No pudimos consultar ARCA: ${msg}` }, { status: 502 });
  }
}
