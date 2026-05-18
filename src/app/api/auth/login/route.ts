import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateInternalUser, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Email o codigo invalido." }, { status: 400 });
  }

  const user = await authenticateInternalUser(parsed.data.email, parsed.data.code);

  if (!user) {
    return NextResponse.json({ error: "No pudimos validar el acceso." }, { status: 401 });
  }

  await createSession(user);
  return NextResponse.json({ ok: true });
}
