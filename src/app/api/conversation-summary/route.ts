import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada");
  return neon(url);
}

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no configurada");
  return new OpenAI({ apiKey: key });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId requerido." }, { status: 400 });

  const sql = getDb();

  // Obtener los últimos 80 mensajes de la conversación
  const rows = await sql`
    SELECT direction, body, created_at
    FROM messages
    WHERE conversation_id = ${conversationId}
      AND body IS NOT NULL
      AND body != ''
    ORDER BY created_at DESC
    LIMIT 80
  ` as Array<{ direction: string; body: string; created_at: string }>;

  if (rows.length === 0) {
    return NextResponse.json({ summary: null });
  }

  // Los mensajes vienen DESC, invertir para que queden en orden cronológico
  const messages = rows.reverse();

  const transcript = messages
    .map((m) => `[${m.direction === "inbound" ? "Cliente" : "Febo"}]: ${m.body}`)
    .join("\n");

  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Sos un asistente de ventas de Febecos (empresa de bombas solares). " +
          "Analizá la conversación de WhatsApp y generá un resumen ejecutivo estructurado en JSON. " +
          "Respondé SOLO con JSON válido, sin markdown, sin explicaciones.",
      },
      {
        role: "user",
        content:
          `Conversación:\n${transcript}\n\n` +
          `Generá un JSON con exactamente estas claves:\n` +
          `- summary: resumen ejecutivo de 2-3 oraciones (quién es, qué necesita, estado del caso)\n` +
          `- last_topic: tema principal de la última parte de la charla (ej: "Cotización bomba 3\" 750W")\n` +
          `- last_intent: intención del cliente en este momento (ej: "Comparando precios", "Listo para comprar", "Pedido info técnica")\n` +
          `- technical_facts: objeto con datos técnicos detectados (profundidad, caudal, diámetro, TDH, cultivo, animales, etc.)\n` +
          `- commercial_facts: objeto con datos comerciales (presupuesto presentado, precio, forma de pago, etc.)\n` +
          `- pending_questions: array de strings con preguntas o acciones pendientes del vendedor\n` +
          `Si no hay datos para algún campo, usá null o [] según corresponda.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Si el modelo devuelve algo raro, mostrar al menos el texto crudo como summary
    parsed = { summary: raw, last_topic: null, last_intent: null, technical_facts: {}, commercial_facts: {}, pending_questions: [] };
  }

  return NextResponse.json({ memory: parsed });
}
