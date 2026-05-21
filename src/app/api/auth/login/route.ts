import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, validateInternalLogin } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().optional(),
  ownerCode: z.string().trim().optional()
});

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Email o codigo invalido." }, { status: 400 });
  }

  try {
    const { user, error } = await validateInternalLogin(parsed.data.email, parsed.data.code ?? "", parsed.data.ownerCode);

    if (!user) {
      return NextResponse.json({ error: error ?? "No pudimos validar el acceso." }, { status: 401 });
    }

    await createSession(user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No pudimos iniciar sesion.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos iniciar sesion." },
      { status: 500 }
    );
  }
}
