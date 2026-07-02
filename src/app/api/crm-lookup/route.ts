import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchClienteFromCrm } from "@/lib/crm-lookup";

// Read-through al CRM central (Gestión) para el modal de contacto. Cualquier usuario logueado
// puede leer — es solo lectura, mismo nivel de acceso que ya tiene sobre el contacto local.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const clienteId = Number(request.nextUrl.searchParams.get("clienteId"));
  if (!clienteId || !Number.isFinite(clienteId)) {
    return NextResponse.json({ error: "clienteId inválido." }, { status: 400 });
  }

  const cliente = await fetchClienteFromCrm(clienteId);
  if (!cliente) {
    return NextResponse.json({ ok: false, cliente: null });
  }

  return NextResponse.json({ ok: true, cliente });
}
