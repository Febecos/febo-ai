import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listLabelDefinitions, restoreBaseLabelDefinitions, upsertLabelDefinition } from "@/lib/crm";

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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    labels: await listLabelDefinitions(request.nextUrl.searchParams.get("all") === "1")
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const restore = restoreSchema.safeParse(body);

  if (restore.success) {
    return NextResponse.json({
      labels: await restoreBaseLabelDefinitions()
    });
  }

  const parsed = labelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Etiqueta invalida." }, { status: 400 });
  }

  const label = await upsertLabelDefinition(parsed.data);

  return NextResponse.json({
    label,
    labels: await listLabelDefinitions(true)
  });
}
