import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  disableTemplateAutomationRule,
  listMessageTemplates,
  listTemplateAutomationRules,
  upsertTemplateAutomationRule
} from "@/lib/crm";

const upsertSchema = z.object({
  action: z.literal("upsert"),
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  consultype: z.string().trim().min(1).max(60),
  templateId: z.string().uuid(),
  delayAmount: z.number().int().min(0).max(365),
  delayUnit: z.enum(["minutes", "hours", "days"]),
  bodyParameters: z.array(z.string().trim().max(200)).default([]),
  active: z.boolean().default(true)
});

const disableSchema = z.object({
  action: z.literal("disable"),
  id: z.string().uuid()
});

const ruleSchema = z.discriminatedUnion("action", [upsertSchema, disableSchema]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    rules: await listTemplateAutomationRules(),
    templates: await listMessageTemplates()
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = ruleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de automatizacion invalidos." }, { status: 400 });
  }

  if (parsed.data.action === "disable") {
    await disableTemplateAutomationRule(parsed.data.id);
  } else {
    await upsertTemplateAutomationRule({
      id: parsed.data.id,
      name: parsed.data.name,
      consultype: parsed.data.consultype,
      templateId: parsed.data.templateId,
      delayAmount: parsed.data.delayAmount,
      delayUnit: parsed.data.delayUnit,
      bodyParameters: parsed.data.bodyParameters,
      active: parsed.data.active,
      createdBy: user.id
    });
  }

  return NextResponse.json({
    ok: true,
    rules: await listTemplateAutomationRules()
  });
}
