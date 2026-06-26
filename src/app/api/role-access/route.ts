import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getRoleMenuAccess, setRoleMenuAccess, MENU_MATRIX_SECTIONS, ROLE_MENU_ROLES } from "@/lib/crm";

const updateSchema = z.object({
  role: z.enum(ROLE_MENU_ROLES),
  access: z.record(z.enum(MENU_MATRIX_SECTIONS), z.boolean())
});

// GET: cualquier usuario logueado puede leer la matriz (la necesita para armar su menú).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json({ access: await getRoleMenuAccess() });
}

// POST: solo admin puede editar qué ve cada rol.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de acceso inválidos." }, { status: 400 });
  }

  try {
    const access = await setRoleMenuAccess(parsed.data.role, parsed.data.access);
    return NextResponse.json({ ok: true, access });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos guardar el acceso." },
      { status: 400 }
    );
  }
}
