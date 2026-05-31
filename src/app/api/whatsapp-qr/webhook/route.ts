import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChannelAccountBridgeAuth, recordIncomingMessage } from "@/lib/crm";

const messageSchema = z.object({
  id: z.string().trim().min(1).max(180),
  from: z.string().trim().min(5).max(80),
  text: z.string().trim().min(1).max(4000),
  contactName: z.string().trim().max(120).optional().nullable()
});

const webhookSchema = z.object({
  accountSlug: z.string().trim().min(2).max(80),
  messages: z.array(messageSchema).min(1).max(20)
});

export async function POST(request: NextRequest) {
  const parsed = webhookSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload QR invalido." }, { status: 400 });
  }

  const account = await getChannelAccountBridgeAuth(parsed.data.accountSlug);

  if (!account || !account.active || account.provider !== "qr_bridge" || !account.webhook_token) {
    return NextResponse.json({ error: "Cuenta QR no configurada." }, { status: 404 });
  }

  const token = getBearerToken(request) ?? request.headers.get("x-febo-qr-token");

  if (!token || token !== account.webhook_token) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const stored = [];

  for (const message of parsed.data.messages) {
    const result = await recordIncomingMessage({
      phone: message.from,
      externalMessageId: message.id,
      text: message.text,
      contactName: message.contactName ?? undefined,
      channel: "whatsapp",
      accountSlug: account.slug,
      externalUserId: message.from
    });

    stored.push({
      messageId: result.messageId,
      conversationId: result.threadId,
      duplicate: result.duplicate
    });
  }

  return NextResponse.json({ ok: true, stored });
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}
