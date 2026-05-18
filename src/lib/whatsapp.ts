import crypto from "node:crypto";
import { config, requireEnv } from "./config";

export type WhatsAppTextMessage = {
  from: string;
  id: string;
  text: string;
  contactName?: string;
};

type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

export function verifyMetaSignature(rawBody: string, signature: string | null) {
  if (!config.WHATSAPP_APP_SECRET) {
    return true;
  }

  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  const actual = Buffer.from(signature.slice(7));
  const expectedBuffer = Buffer.from(expected);

  if (actual.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expectedBuffer);
}

export function extractTextMessages(body: WhatsAppWebhookBody): WhatsAppTextMessage[] {
  const messages: WhatsAppTextMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contact = value?.contacts?.[0];

      for (const message of value?.messages ?? []) {
        if (message.type !== "text" || !message.text?.body || !message.from || !message.id) {
          continue;
        }

        messages.push({
          from: message.from,
          id: message.id,
          text: message.text.body,
          contactName: contact?.profile?.name
        });
      }
    }
  }

  return messages;
}

export async function sendWhatsAppText(to: string, body: string) {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API respondio ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
