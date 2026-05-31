export type WhatsAppQrBridgeConfig = {
  provider: string | null;
  bridgeUrl: string | null;
  bridgeToken: string | null;
};

export function isWhatsAppQrBridge(config: WhatsAppQrBridgeConfig | null | undefined) {
  return Boolean(
    config?.provider === "qr_bridge" &&
    config.bridgeUrl &&
    config.bridgeToken
  );
}

export async function sendWhatsAppQrText(input: {
  bridgeUrl: string;
  bridgeToken: string;
  to: string;
  body: string;
  conversationId: string;
}) {
  const response = await fetch(`${input.bridgeUrl.replace(/\/+$/, "")}/send-message`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.bridgeToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      to: input.to,
      text: input.body,
      conversationId: input.conversationId
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp QR bridge no pudo enviar el mensaje (${response.status}): ${body}`);
  }

  return response.json() as Promise<{ id?: string; messageId?: string; messages?: Array<{ id?: string }> }>;
}

export function getWhatsAppQrSentMessageId(response: unknown) {
  const data = response as { id?: string; messageId?: string; messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? data.messageId ?? data.id ?? null;
}
