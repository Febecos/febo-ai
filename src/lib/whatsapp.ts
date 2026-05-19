import crypto from "node:crypto";
import { config, requireEnv } from "./config";

export type WhatsAppTextMessage = {
  from: string;
  id: string;
  text: string;
  contactName?: string;
  interactiveId?: string;
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

export type WhatsAppMessageStatus = {
  id: string;
  recipientId?: string;
  status: string;
  timestamp?: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    details?: string;
  }>;
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
          audio?: { id?: string; mime_type?: string; sha256?: string; voice?: boolean };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
          };
        }>;
        statuses?: Array<{
          id?: string;
          recipient_id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{
            code?: number;
            title?: string;
            message?: string;
            error_data?: { details?: string };
          }>;
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

        if (message.type === "interactive" && message.interactive?.button_reply?.title) {
          messages.push({
            from: message.from,
            id: message.id,
            text: message.interactive.button_reply.title,
            interactiveId: message.interactive.button_reply.id,
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

export function extractMessageStatuses(body: WhatsAppWebhookBody): WhatsAppMessageStatus[] {
  const statuses: WhatsAppMessageStatus[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (!status.id || !status.status) {
          continue;
        }

        statuses.push({
          id: status.id,
          recipientId: status.recipient_id,
          status: status.status,
          timestamp: status.timestamp,
          errors: status.errors?.map((error) => ({
            code: error.code,
            title: error.title,
            message: error.message,
            details: error.error_data?.details
          }))
        });
      }
    }
  }

  return statuses;
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
    throw new Error(await getWhatsAppErrorMessage(metadataResponse, "obtener el archivo de WhatsApp"));
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
    throw new Error(await getWhatsAppErrorMessage(mediaResponse, "descargar el archivo de WhatsApp"));
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
    throw new Error(await getWhatsAppErrorMessage(response, "enviar el mensaje"));
  }

  return response.json();
}

export async function sendWhatsAppReplyButtons(input: {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}) {
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
      to: input.to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: input.body
        },
        action: {
          buttons: input.buttons.slice(0, 3).map((button) => ({
            type: "reply",
            reply: {
              id: button.id,
              title: button.title.slice(0, 20)
            }
          }))
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(await getWhatsAppErrorMessage(response, "enviar los botones"));
  }

  return response.json();
}

export async function sendWhatsAppTemplate(input: {
  to: string;
  name: string;
  languageCode: string;
  bodyParameters?: string[];
}) {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const parameters = input.bodyParameters?.filter((value) => value.trim()).map((value) => ({
    type: "text",
    text: value.trim()
  }));

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: input.name,
        language: {
          code: input.languageCode
        },
        ...(parameters?.length ?
          {
            components: [
              {
                type: "body",
                parameters
              }
            ]
          }
        : {})
      }
    })
  });

  if (!response.ok) {
    throw new Error(await getWhatsAppErrorMessage(response, "enviar la plantilla"));
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
    throw new Error(await getWhatsAppErrorMessage(response, "subir el archivo"));
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
    throw new Error(await getWhatsAppErrorMessage(response, "enviar el audio"));
  }

  return response.json();
}

export async function sendWhatsAppImage(to: string, mediaId: string, caption?: string) {
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
      type: "image",
      image: {
        id: mediaId,
        ...(caption ? { caption } : {})
      }
    })
  });

  if (!response.ok) {
    throw new Error(await getWhatsAppErrorMessage(response, "enviar la imagen"));
  }

  return response.json();
}

export async function sendWhatsAppVideo(to: string, mediaId: string, caption?: string) {
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
      type: "video",
      video: {
        id: mediaId,
        ...(caption ? { caption } : {})
      }
    })
  });

  if (!response.ok) {
    throw new Error(await getWhatsAppErrorMessage(response, "enviar el video"));
  }

  return response.json();
}

export async function sendWhatsAppDocument(to: string, mediaId: string, filename: string, caption?: string) {
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
      type: "document",
      document: {
        id: mediaId,
        filename,
        ...(caption ? { caption } : {})
      }
    })
  });

  if (!response.ok) {
    throw new Error(await getWhatsAppErrorMessage(response, "enviar el archivo"));
  }

  return response.json();
}

async function getWhatsAppErrorMessage(response: Response, action: string) {
  const body = await response.text();
  let metaError: { message?: string; code?: number; type?: string } | null = null;

  try {
    metaError = (JSON.parse(body) as { error?: { message?: string; code?: number; type?: string } }).error ?? null;
  } catch {
    metaError = null;
  }

  if (response.status === 401 || metaError?.code === 190 || metaError?.type === "OAuthException") {
    return "Token de WhatsApp vencido o invalido. Actualiza WHATSAPP_ACCESS_TOKEN en Vercel con un token vigente de Meta y redeploya.";
  }

  return `WhatsApp Cloud API no pudo ${action} (${response.status}): ${metaError?.message ?? body}`;
}
