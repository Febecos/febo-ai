import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getConversationReplyTarget, listConversationMessages, recordManualOutboundMessage, saveMessageMedia } from "@/lib/crm";
import {
  sendWhatsAppAudio,
  sendWhatsAppDocument,
  sendWhatsAppImage,
  sendWhatsAppText,
  uploadWhatsAppMedia
} from "@/lib/whatsapp";

const schema = z.object({
  conversationId: z.string().uuid()
});

const sendSchema = schema.extend({
  text: z.string().trim().min(1).max(4000)
});

const supportedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];

const supportedAudioMimeTypes = [
  "audio/aac",
  "audio/amr",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg"
];

const supportedDocumentMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain"
];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = schema.safeParse({
    conversationId: request.nextUrl.searchParams.get("conversationId")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Conversacion invalida." }, { status: 400 });
  }

  return NextResponse.json({
    messages: await listConversationMessages(parsed.data.conversationId)
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const parsed = contentType.includes("multipart/form-data")
    ? await parseAttachmentRequest(request)
    : sendSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: getSendValidationError(parsed.error) }, { status: 400 });
  }

  const target = await getConversationReplyTarget(parsed.data.conversationId);

  if (!target) {
    return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
  }

  try {
    if ("file" in parsed.data) {
      const file = parsed.data.file;
      const caption = parsed.data.caption;
      const uploaded = await uploadWhatsAppMedia(file);
      const mediaKind = getMediaKind(file.type);

      if (mediaKind === "audio") {
        await sendWhatsAppAudio(target.phone, uploaded.id);
      } else if (mediaKind === "image") {
        await sendWhatsAppImage(target.phone, uploaded.id, caption);
      } else {
        await sendWhatsAppDocument(target.phone, uploaded.id, file.name || "archivo", caption);
      }

      const messageId = await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: buildAttachmentBody(file, caption)
      });
      const buffer = Buffer.from(await file.arrayBuffer());

      await saveMessageMedia({
        messageId,
        waMediaId: uploaded.id,
        mimeType: file.type || "application/octet-stream",
        filename: file.name || "archivo",
        fileSize: file.size,
        dataBase64: buffer.toString("base64")
      });
    } else {
      await sendWhatsAppText(target.phone, parsed.data.text);
      await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: parsed.data.text
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos enviar el WhatsApp." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    messages: await listConversationMessages(parsed.data.conversationId)
  });
}

async function parseAttachmentRequest(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") ?? formData.get("audio");
  const caption = formData.get("caption");

  return z
    .object({
      conversationId: z.string().uuid(),
      caption: z.string().trim().max(1024).optional(),
      file: z
        .instanceof(File)
        .refine((inputFile) => inputFile.size > 0 && inputFile.size <= 16 * 1024 * 1024)
        .refine((inputFile) => isSupportedWhatsAppAttachment(inputFile.type))
    })
    .safeParse({
      conversationId: formData.get("conversationId"),
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : undefined,
      file
    });
}

function isSupportedWhatsAppAudio(mimeType: string) {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  return supportedAudioMimeTypes.includes(normalized);
}

function isSupportedWhatsAppAttachment(mimeType: string) {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  return supportedImageMimeTypes.includes(normalized) || supportedAudioMimeTypes.includes(normalized) || supportedDocumentMimeTypes.includes(normalized);
}

function getMediaKind(mimeType: string) {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();

  if (supportedAudioMimeTypes.includes(normalized)) {
    return "audio";
  }

  if (supportedImageMimeTypes.includes(normalized)) {
    return "image";
  }

  return "document";
}

function buildAttachmentBody(file: File, caption?: string) {
  const mediaKind = getMediaKind(file.type);

  if (caption) {
    return caption;
  }

  if (mediaKind === "audio") {
    return "Audio enviado";
  }

  if (mediaKind === "image") {
    return `Imagen enviada: ${file.name || "imagen"}`;
  }

  return `Archivo enviado: ${file.name || "archivo"}`;
}

function getSendValidationError(error: z.ZodError) {
  const fileErrors = error.flatten().fieldErrors.file ?? [];

  if (fileErrors.length) {
    return "Formato no compatible con WhatsApp o archivo demasiado grande. Proba con imagen, PDF, Office o audio compatible.";
  }

  return "Mensaje invalido.";
}
