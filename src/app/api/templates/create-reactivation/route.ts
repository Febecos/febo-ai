import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { createWhatsAppMessageTemplate } from "@/lib/whatsapp";
import { upsertLabelDefinition } from "@/lib/crm";
import { REACTIVATION_TEMPLATES, REACTIVATION_LABELS } from "@/lib/reactivation-templates";

export const maxDuration = 60;

// TAREA 2 (campaña reactivación jul-2026): da de alta en Meta las 3 plantillas MARKETING
// (a aprobación) + crea las 6 etiquetas si no existen. Aditivo. Autorizado por admin logueado
// o Bearer ADMIN_TOOLS_TOKEN (fail-closed).
async function authorize(request: NextRequest): Promise<boolean> {
  const token = config.ADMIN_TOOLS_TOKEN;
  const auth = request.headers.get("authorization");
  if (token && auth === `Bearer ${token}`) return true;
  const user = await getCurrentUser();
  return user?.role === "admin";
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // 1) Etiquetas (best-effort, no bloquean las plantillas).
  const labels: Array<{ slug: string; ok: boolean; error?: string }> = [];
  for (const l of REACTIVATION_LABELS) {
    try {
      await upsertLabelDefinition({ slug: l.slug, name: l.name, color: l.color, instructions: l.instructions, active: true, sortOrder: 300 });
      labels.push({ slug: l.slug, ok: true });
    } catch (e) {
      labels.push({ slug: l.slug, ok: false, error: e instanceof Error ? e.message : "error" });
    }
  }

  // 2) Plantillas → Meta (a aprobación). Cada una por separado para reportar estado individual.
  const templates: Array<{ name: string; ok: boolean; id?: string; status?: string; error?: string }> = [];
  for (const t of REACTIVATION_TEMPLATES) {
    try {
      const res = await createWhatsAppMessageTemplate({
        name: t.name,
        language: t.language,
        category: t.category,
        body: t.body,
        example: t.example
      });
      templates.push({ name: t.name, ok: true, id: res.id, status: res.status });
    } catch (e) {
      templates.push({ name: t.name, ok: false, error: e instanceof Error ? e.message : "error" });
    }
  }

  const allTemplatesOk = templates.every((t) => t.ok);
  return NextResponse.json({ ok: allTemplatesOk, templates, labels });
}
