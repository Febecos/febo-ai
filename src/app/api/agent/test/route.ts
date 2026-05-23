import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runFebecosAgent } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  phone: z.string().min(6),
  message: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Telefono o mensaje invalido." }, { status: 400 });
  }

  try {
    const result = await runFebecosAgent(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
