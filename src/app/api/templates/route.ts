import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listMessageTemplates, upsertMessageTemplate } from "@/lib/crm";

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  languageCode: z.string().trim().min(2).max(12).default("es_AR"),
  category: z.string().trim().min(2).max(30).default("utility"),
  body: z.string().trim().max(1000).default(""),
  active: z.boolean().default(true)
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({ templates: await listMessageTemplates() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = templateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de plantilla invalidos." }, { status: 400 });
  }

  await upsertMessageTemplate(parsed.data);

  return NextResponse.json({
    ok: true,
    templates: await listMessageTemplates()
  });
}
