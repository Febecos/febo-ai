import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, validateInternalLogin } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().min(1),
  ownerCode: z.string().trim().optional()
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Email o codigo invalido." }, { status: 400 });
  }

  const { user, error } = await validateInternalLogin(parsed.data.email, parsed.data.code, parsed.data.ownerCode);

  if (!user) {
    return NextResponse.json({ error: error ?? "No pudimos validar el acceso." }, { status: 401 });
  }

  await createSession(user);
  return NextResponse.json({ ok: true });
}
