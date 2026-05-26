import crypto from "node:crypto";
import { config, requireEnv } from "./config";
import { getSettingValue } from "./crm";

export type WhatsAppTextMessage = {
  from: string;
  id: string;
  text: string;
  contactName?: string;
  interactiveId?: string;
  flowResponse?: Record<string, unknown>;
};

export type WhatsAppAudioMessage = {
  from: string;
  id: string;
  type: "audio";
  mediaId: string;
  mimeType: string;
  sha256?: string;
  voice?: boolean;
  contactName?: string;
};

export type WhatsAppMediaMessage = {
  from: string;
  id: string;
  type: "image" | "video" | "document";
  mediaId: string;
  mimeType: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  contactName?: string;
};

export type WhatsAppInboundMessage = WhatsAppTextMessage | WhatsAppAudioMessage | WhatsAppMediaMessage;

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

export type WhatsAppTemplateSummary = {
  label: string;
  name: string;
  languageCode: string;
  category: string;
  body: string;
  active: boolean;
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
          image?: { id?: string; mime_type?: string; sha256?: string; caption?: string };
          video?: { id?: string; mime_type?: string; sha256?: string; caption?: string };
          document?: { id?: string; mime_type?: string; sha256?: string; caption?: string; filename?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            nfm_reply?: { name?: string; body?: string; response_json?: string };
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

type MetaTemplateResponse = {
  data?: Array<{
    name?: string;
    language?: string;
    category?: string;
    status?: string;
    components?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  paging?: {
    next?: string;
  };
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

        if (message.type === "interactive" && message.interactive?.nfm_reply) {
          const response = parseFlowResponse(message.interactive.nfm_reply.response_json);
          messages.push({
            from: message.from,
            id: message.id,
            text: buildFlowResponseText(response, message.interactive.nfm_reply.body),
            interactiveId: `flow:${message.interactive.nfm_reply.name ?? "unknown"}`,
            flowResponse: response,
            contactName: contact?.profile?.name
          });
        }

        if (message.type === "audio" && message.audio?.id && message.audio.mime_type) {
          messages.push({
            from: message.from,
            id: message.id,
            type: "audio",
            mediaId: message.audio.id,
            mimeType: message.audio.mime_type,
            sha256: message.audio.sha256,
            voice: message.audio.voice,
            contactName: contact?.profile?.name
          });
        }

        if (message.type === "image" && message.image?.id && message.image.mime_type) {
          messages.push({
            from: message.from,
            id: message.id,
            type: "image",
            mediaId: message.image.id,
            mimeType: message.image.mime_type,
            sha256: message.image.sha256,
            caption: message.image.caption,
            contactName: contact?.profile?.name
          });
        }

        if (message.type === "video" && message.video?.id && message.video.mime_type) {
          messages.push({
            from: message.from,
            id: message.id,
            type: "video",
            mediaId: message.video.id,
            mimeType: message.video.mime_type,
            sha256: message.video.sha256,
            caption: message.video.caption,
            contactName: contact?.profile?.name
          });
        }

        if (message.type === "document" && message.document?.id && message.document.mime_type) {
          messages.push({
            from: message.from,
            id: message.id,
            type: "document",
            mediaId: message.document.id,
            mimeType: message.document.mime_type,
            sha256: message.document.sha256,
            caption: message.document.caption,
            filename: message.document.filename,
            contactName: contact?.profile?.name
          });
        }
      }
    }
  }

  return messages;
}

function parseFlowResponse(responseJson?: string) {
  if (!responseJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(responseJson);
    return typeof parsed === "object" && parsed ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function buildFlowResponseText(response: Record<string, unknown>, fallback?: string) {
  const hiddenKeys = new Set(["flow_token"]);
  const entries = Object.entries(response)
    .filter(([key]) => !hiddenKeys.has(key))
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${humanizeTemplateName(key)}: ${String(value)}`);

  if (entries.length) {
    return `Selector WhatsApp completado:\n${entries.join("\n")}`;
  }

  return fallback || "Selector WhatsApp completado";
}

export async function fetchWhatsAppMessageTemplates() {
  const businessAccountId = requireEnv("WHATSAPP_BUSINESS_ACCOUNT_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const templates: WhatsAppTemplateSummary[] = [];
  let nextUrl =
    `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates?` +
    new URLSearchParams({
      fields: "name,language,category,status,components",
      limit: "100",
      access_token: accessToken
    }).toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(await getWhatsAppErrorMessage(response, "leer las plantillas"));
    }

    const payload = (await response.json()) as MetaTemplateResponse;

    for (const template of payload.data ?? []) {
      if (!template.name || !template.language) {
        continue;
      }

      const body = template.components?.find((component) => component.type === "BODY")?.text ?? "";
      const status = template.status?.toUpperCase() ?? "";

      templates.push({
        label: humanizeTemplateName(template.name),
        name: template.name,
        languageCode: template.language,
        category: (template.category ?? "utility").toLowerCase(),
        body,
        active: status ? status === "APPROVED" : true
      });
    }

    nextUrl = payload.paging?.next ?? "";
  }

  return templates;
}

function humanizeTemplateName(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  return "mediaId" in message && (!("type" in message) || message.type === "audio");
}

export function isWhatsAppMediaMessage(message: WhatsAppInboundMessage): message is WhatsAppMediaMessage {
  return "mediaId" in message && "type" in message && ["image", "video", "document"].includes(message.type);
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

export async function sendWhatsAppSelectorFlow(input: {
  to: string;
  conversationId: string;
  contactName?: string | null;
}) {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const configuredFlowId = await getSettingValue("whatsapp_selector_flow_id", "");
  const flowId = configuredFlowId || config.WHATSAPP_SELECTOR_FLOW_ID || "";
  const screen = (await getSettingValue("whatsapp_selector_flow_screen", "")) || config.WHATSAPP_SELECTOR_FLOW_SCREEN;
  const header = (await getSettingValue("whatsapp_selector_flow_header", "")) || "Selector Febecos";
  const body = (await getSettingValue(
    "whatsapp_selector_flow_body",
    ""
  )) || "Completa estos datos dentro de WhatsApp y te sugerimos el equipo de bombeo solar adecuado.";
  const footer = (await getSettingValue("whatsapp_selector_flow_footer", "")) || "Febecos bombas solares";
  const cta = (await getSettingValue("whatsapp_selector_flow_cta", "")) || "Abrir selector";

  if (!flowId) {
    throw new Error("Falta configurar el Flow ID del selector de WhatsApp.");
  }

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
        type: "flow",
        header: {
          type: "text",
          text: header
        },
        body: {
          text: body
        },
        footer: {
          text: footer
        },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: flowId,
            flow_token: JSON.stringify({
              source: "febo-ai",
              conversationId: input.conversationId
            }),
            flow_cta: cta,
            flow_action: "navigate",
            flow_action_payload: {
              screen,
              data: {
                nombre: input.contactName ?? "",
                origen: "febo-ai"
              }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(await getWhatsAppErrorMessage(response, "enviar el selector de WhatsApp"));
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

export async function sendWhatsAppVideoLink(to: string, link: string, caption?: string) {
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
        link,
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

export async function sendWhatsAppDocumentLink(to: string, link: string, filename: string, caption?: string) {
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
        link,
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

  if (response.status === 401 || metaError?.code === 190) {
    return "Token de WhatsApp vencido o invalido. Actualiza WHATSAPP_ACCESS_TOKEN en Vercel con un token vigente de Meta y redeploya.";
  }

  return `WhatsApp Cloud API no pudo ${action} (${response.status}): ${metaError?.message ?? body}`;
}
