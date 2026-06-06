import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { applyRecommendedLabelInstructions, listConversationConsultypeLabels, listLabelDefinitions, restoreBaseLabelDefinitions, upsertLabelDefinition } from "@/lib/crm";

const labelSchema = z.object({
  slug: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2).max(80),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i),
  instructions: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional()
});
const restoreSchema = z.object({
  action: z.literal("restore-base")
});
const applyAiSchema = z.object({
  action: z.literal("apply-ai-descriptions")
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    labels: await listLabelDefinitions(user.role === "admin" && request.nextUrl.searchParams.get("all") === "1"),
    conversationLabels: await listConversationConsultypeLabels()
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();

  const applyAi = applyAiSchema.safeParse(body);
  if (applyAi.success) {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Solo administrador." }, { status: 403 });
    }
    return NextResponse.json({ labels: await applyRecommendedLabelInstructions() });
  }

  const restore = restoreSchema.safeParse(body);

  if (restore.success) {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Solo administrador puede restaurar etiquetas base." }, { status: 403 });
    }

    return NextResponse.json({
      labels: await restoreBaseLabelDefinitions()
    });
  }

  const parsed = labelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Etiqueta invalida." }, { status: 400 });
  }

  const label = await upsertLabelDefinition(
    user.role === "admin"
      ? parsed.data
      : {
          name: parsed.data.name,
          color: parsed.data.color,
          instructions: "Etiqueta creada desde ventas. Revisar instrucciones desde administrador.",
          active: true,
          sortOrder: 500
        }
  );

  return NextResponse.json({
    label,
    labels: await listLabelDefinitions(true)
  });
}
