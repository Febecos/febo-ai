import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hashLoginCode } from "@/lib/auth";
import { getAdminUsers, upsertAppUser } from "@/lib/crm";

const userSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "vendedor"]),
  active: z.boolean().default(true),
  code: z.string().optional()
});

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

export async function GET() {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({ users: await getAdminUsers() });
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = userSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de usuario invalidos." }, { status: 400 });
  }

  const code = parsed.data.code?.trim();

  if (!parsed.data.id && !code) {
    return NextResponse.json({ error: "Para crear un usuario nuevo, carga un codigo." }, { status: 400 });
  }

  if (parsed.data.id === user.id && (!parsed.data.active || parsed.data.role !== "admin")) {
    return NextResponse.json({ error: "No podes quitarte tu propio acceso administrador." }, { status: 400 });
  }

  const saved = await upsertAppUser({
    id: parsed.data.id,
    fullName: parsed.data.fullName.trim(),
    email: parsed.data.email.trim(),
    role: parsed.data.role,
    active: parsed.data.active,
    loginCodeHash: code ? hashLoginCode(code) : undefined
  });

  return NextResponse.json({ user: saved, users: await getAdminUsers() });
}
