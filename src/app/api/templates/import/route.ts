import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listMessageTemplates, upsertMessageTemplates } from "@/lib/crm";

const importedTemplateSchema = z.object({
  label: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  languageCode: z.string().trim().min(2).max(12).default("es_AR"),
  category: z.string().trim().min(2).max(30).default("utility"),
  body: z.string().trim().max(1000).default(""),
  active: z.boolean().default(true)
});

const importSchema = z.object({
  templates: z.array(importedTemplateSchema).min(1).max(100)
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = importSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Lote de plantillas invalido." }, { status: 400 });
  }

  await upsertMessageTemplates(parsed.data.templates);

  return NextResponse.json({
    ok: true,
    imported: parsed.data.templates.length,
    templates: await listMessageTemplates()
  });
}
