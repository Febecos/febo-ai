import crypto from "node:crypto";
import { config, requireEnv } from "./config";

export type WhatsAppTextMessage = {
  from: string;
  id: string;
  text: string;
  contactName?: string;
};

export type WhatsAppAudioMessage = {
  from: string;
  id: string;
  mediaId: string;
  mimeType: string;
  sha256?: string;
  voice?: boolean;
  contactName?: string;
};

export type WhatsAppInboundMessage = WhatsAppTextMessage | WhatsAppAudioMessage;

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
          audio?: { id?: string; mime_type?: string; sha256?: string; voice?: boolean };
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

export function extractInboundMessages(body: WhatsAppWebhookBody): WhatsAppInboundMessage[] {
  const messages: WhatsAppInboundMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contact = value?.contacts?.[0];

      for (const message of value?.messages ?? []) {
        if (!message.from || !message.id) {
          continue;
        }

        if (message.type === "text" && message.text?.body) {
          messages.push({
            from: message.from,
            id: message.id,
            text: message.text.body,
            contactName: contact?.profile?.name
          });
        }

        if (message.type === "audio" && message.audio?.id && message.audio.mime_type) {
          messages.push({
            from: message.from,
            id: message.id,
            mediaId: message.audio.id,
            mimeType: message.audio.mime_type,
            sha256: message.audio.sha256,
            voice: message.audio.voice,
            contactName: contact?.profile?.name
          });
        }
      }
    }
  }

  return messages;
}

export function isWhatsAppAudioMessage(message: WhatsAppInboundMessage): message is WhatsAppAudioMessage {
  return "mediaId" in message;
}

export function isWhatsAppTextMessage(message: WhatsAppInboundMessage): message is WhatsAppTextMessage {
  return "text" in message;
}

export async function downloadWhatsAppMedia(mediaId: string) {
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");

  const metadataResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!metadataResponse.ok) {
    throw new Error(`No pudimos obtener el audio de WhatsApp (${metadataResponse.status}).`);
  }

  const metadata = (await metadataResponse.json()) as {
    url?: string;
    mime_type?: string;
    sha256?: string;
    file_size?: number;
    id?: string;
  };

  if (!metadata.url) {
    throw new Error("WhatsApp no devolvio URL de audio.");
  }

  const mediaResponse = await fetch(metadata.url, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!mediaResponse.ok) {
    throw new Error(`No pudimos descargar el audio de WhatsApp (${mediaResponse.status}).`);
  }

  const buffer = Buffer.from(await mediaResponse.arrayBuffer());

  return {
    dataBase64: buffer.toString("base64"),
    fileSize: metadata.file_size ?? buffer.byteLength,
    mimeType: metadata.mime_type ?? mediaResponse.headers.get("content-type") ?? "audio/ogg",
    sha256: metadata.sha256,
    waMediaId: metadata.id ?? mediaId
  };
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

export async function uploadWhatsAppMedia(file: File) {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const formData = new FormData();

  formData.append("messaging_product", "whatsapp");
  formData.append("file", file, file.name || "audio");

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/media`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API no pudo subir el audio (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as { id: string };
}

export async function sendWhatsAppAudio(to: string, mediaId: string) {
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
      type: "audio",
      audio: {
        id: mediaId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API respondio ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
