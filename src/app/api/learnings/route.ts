import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  distillLearnings,
  listLearnings,
  setLearningStatus,
  updateLearning
} from "@/lib/learnings";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Solo admin." }, { status: 403 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam === "pending" || statusParam === "approved" || statusParam === "rejected" ? statusParam : undefined;
  const learnings = await listLearnings(status);
  return NextResponse.json({ ok: true, learnings });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  if (body?.action === "distill") {
    try {
      const result = await distillLearnings(Number(body.sinceHours) > 0 ? Number(body.sinceHours) : 72);
      return NextResponse.json(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No pudimos destilar.";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Accion invalida." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  if (body?.status === "approved" || body?.status === "rejected" || body?.status === "pending") {
    const updated = await setLearningStatus(id, body.status, user!.id);
    return NextResponse.json({ ok: Boolean(updated), learning: updated });
  }

  if (body?.topic || body?.customer_pattern || body?.how_to_respond) {
    const updated = await updateLearning(id, {
      topic: body.topic,
      customer_pattern: body.customer_pattern,
      how_to_respond: body.how_to_respond
    });
    return NextResponse.json({ ok: Boolean(updated) });
  }

  return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });
}
