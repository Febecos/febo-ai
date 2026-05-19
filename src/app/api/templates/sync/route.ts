import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMessageTemplates, upsertMessageTemplates } from "@/lib/crm";
import { fetchWhatsAppMessageTemplates } from "@/lib/whatsapp";

export async function POST() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const metaTemplates = await fetchWhatsAppMessageTemplates();
    await upsertMessageTemplates(metaTemplates);

    return NextResponse.json({
      ok: true,
      imported: metaTemplates.length,
      templates: await listMessageTemplates()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No pudimos sincronizar plantillas desde Meta."
      },
      { status: 400 }
    );
  }
}
