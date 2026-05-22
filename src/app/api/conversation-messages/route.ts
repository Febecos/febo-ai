import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getConversationReplyTarget, listConversationMessages, recordManualOutboundMessage, saveMessageMedia } from "@/lib/crm";
import {
  sendWhatsAppAudio,
  sendWhatsAppDocument,
  sendWhatsAppDocumentLink,
  sendWhatsAppImage,
  sendWhatsAppText,
  sendWhatsAppVideo,
  sendWhatsAppVideoLink,
  uploadWhatsAppMedia
} from "@/lib/whatsapp";

export const maxDuration = 60;

const schema = z.object({
  conversationId: z.string().uuid()
});

const sendSchema = schema.extend({
  text: z.string().trim().min(1).max(4000)
});

const linkedMediaSchema = schema.extend({
  text: z.string().trim().max(1024).optional(),
  media: z.object({
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(120),
    size: z.number().int().positive().max(100 * 1024 * 1024),
    url: z.string().url()
  })
});

const supportedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const supportedVideoMimeTypes = ["video/mp4", "video/3gpp", "video/3gp"];

const supportedAudioMimeTypes = [
  "audio/aac",
  "audio/amr",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg"
];

const convertibleAudioMimeTypes = [
  "audio/wav",
  "audio/x-wav"
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
    : parseJsonSendRequest(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: getSendValidationError(parsed.error) }, { status: 400 });
  }

  const target = await getConversationReplyTarget(parsed.data.conversationId);

  if (!target) {
    return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
  }

  try {
    if ("media" in parsed.data) {
      const mediaKind = getMediaKind({
        name: parsed.data.media.filename,
        type: parsed.data.media.mimeType
      });
      const caption = parsed.data.text;
      let waMessageId: string | null = null;

      if (mediaKind === "video") {
        try {
          const sent = await sendWhatsAppVideoLink(target.phone, parsed.data.media.url, caption);
          waMessageId = getSentMessageId(sent);
        } catch (videoError) {
          const sent = await sendWhatsAppDocumentLink(target.phone, parsed.data.media.url, parsed.data.media.filename, caption);
          waMessageId = getSentMessageId(sent);
          console.warn("WhatsApp linked video send failed; sent as document instead.", videoError);
        }
      } else {
        const sent = await sendWhatsAppDocumentLink(target.phone, parsed.data.media.url, parsed.data.media.filename, caption);
        waMessageId = getSentMessageId(sent);
      }

      await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: buildAttachmentBody({ name: parsed.data.media.filename, type: parsed.data.media.mimeType }, caption),
        waMessageId
      });
    } else if ("file" in parsed.data) {
      const file = parsed.data.file;
      const caption = parsed.data.caption;
      const whatsappFile = await prepareAttachmentForWhatsApp(file);
      const mediaKind = getMediaKind(whatsappFile);
      let waMessageId: string | null = null;
      let uploaded: { id: string } | null = null;

      if (mediaKind === "audio") {
        if (shouldSendAudioAsDocumentLink(whatsappFile)) {
          const blob = await put(
            `manual-audio/${Date.now()}-${sanitizeBlobPathname(whatsappFile.name || file.name || "audio")}`,
            whatsappFile,
            {
              access: "public",
              addRandomSuffix: true,
              contentType: whatsappFile.type || "application/octet-stream"
            }
          );
          const sent = await sendWhatsAppDocumentLink(
            target.phone,
            blob.url,
            whatsappFile.name || file.name || "audio",
            caption
          );
          waMessageId = getSentMessageId(sent);
        } else {
          try {
            uploaded = await uploadWhatsAppMedia(whatsappFile);
            const sent = await sendWhatsAppAudio(target.phone, uploaded.id);
            waMessageId = getSentMessageId(sent);
          } catch (audioError) {
            const blob = await put(
              `manual-audio/${Date.now()}-${sanitizeBlobPathname(whatsappFile.name || file.name || "audio")}`,
              whatsappFile,
              {
                access: "public",
                addRandomSuffix: true,
                contentType: whatsappFile.type || "application/octet-stream"
              }
            );
            const sent = await sendWhatsAppDocumentLink(
              target.phone,
              blob.url,
              whatsappFile.name || file.name || "audio",
              caption
            );
            waMessageId = getSentMessageId(sent);
            console.warn("WhatsApp audio send failed; sent as linked document instead.", audioError);
          }
        }
      } else if (mediaKind === "image") {
        uploaded = await uploadWhatsAppMedia(whatsappFile);
        const sent = await sendWhatsAppImage(target.phone, uploaded.id, caption);
        waMessageId = getSentMessageId(sent);
      } else if (mediaKind === "video") {
        uploaded = await uploadWhatsAppMedia(whatsappFile);
        try {
          const sent = await sendWhatsAppVideo(target.phone, uploaded.id, caption);
          waMessageId = getSentMessageId(sent);
        } catch (videoError) {
          const sent = await sendWhatsAppDocument(target.phone, uploaded.id, whatsappFile.name || file.name || "video.mp4", caption);
          waMessageId = getSentMessageId(sent);
          console.warn("WhatsApp video send failed; sent as document instead.", videoError);
        }
      } else {
        uploaded = await uploadWhatsAppMedia(whatsappFile);
        const sent = await sendWhatsAppDocument(target.phone, uploaded.id, whatsappFile.name || file.name || "archivo", caption);
        waMessageId = getSentMessageId(sent);
      }

      const messageId = await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: buildAttachmentBody(whatsappFile, caption),
        waMessageId
      });
      const buffer = Buffer.from(await whatsappFile.arrayBuffer());

      await saveMessageMedia({
        messageId,
        waMediaId: uploaded?.id ?? null,
        mimeType: whatsappFile.type || "application/octet-stream",
        filename: whatsappFile.name || file.name || "archivo",
        fileSize: whatsappFile.size,
        dataBase64: buffer.toString("base64")
      });
    } else {
      const sent = await sendWhatsAppText(target.phone, parsed.data.text);
      await recordManualOutboundMessage({
        conversationId: parsed.data.conversationId,
        contactId: target.contact_id,
        userId: user.id,
        body: parsed.data.text,
        waMessageId: getSentMessageId(sent)
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

function shouldSendAudioAsDocumentLink(file: File) {
  return getAttachmentMimeType(file) === "audio/mp4";
}

function sanitizeBlobPathname(filename: string) {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "audio";
}

function getSentMessageId(response: unknown) {
  const data = response as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
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
        .refine((inputFile) => isSupportedWhatsAppAttachment(inputFile))
    })
    .safeParse({
      conversationId: formData.get("conversationId"),
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : undefined,
      file
    });
}

function parseJsonSendRequest(input: unknown) {
  return z.union([sendSchema, linkedMediaSchema]).safeParse(input);
}

function isSupportedWhatsAppAudio(mimeType: string) {
  const raw = mimeType.trim().toLowerCase();
  const normalized = raw.split(";")[0].trim();

  if (normalized === "audio/mp4" && raw.includes("opus")) {
    return false;
  }

  return supportedAudioMimeTypes.includes(normalized) || convertibleAudioMimeTypes.includes(normalized);
}

function getAttachmentMimeType(file: Pick<File, "name" | "type">) {
  const normalized = file.type.split(";")[0].trim().toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "mp4" && (!normalized || normalized === "application/octet-stream" || normalized === "video/quicktime")) {
    return "video/mp4";
  }

  if (extension === "3gp" && (!normalized || normalized === "application/octet-stream")) {
    return "video/3gpp";
  }

  if (["m4a", "mp4a"].includes(extension ?? "") && (!normalized || normalized === "application/octet-stream")) {
    return "audio/mp4";
  }

  if (extension === "aac" && (!normalized || normalized === "application/octet-stream")) {
    return "audio/aac";
  }

  if (extension === "mp3" && (!normalized || normalized === "application/octet-stream")) {
    return "audio/mpeg";
  }

  if (extension === "ogg" && (!normalized || normalized === "application/octet-stream")) {
    return "audio/ogg";
  }

  if (extension === "wav" && (!normalized || normalized === "application/octet-stream")) {
    return "audio/wav";
  }

  if (normalized && normalized !== "application/octet-stream") {
    return normalized;
  }

  if (extension === "mp4") {
    return "video/mp4";
  }

  if (extension === "3gp") {
    return "video/3gpp";
  }

  if (["m4a", "mp4a"].includes(extension ?? "")) {
    return "audio/mp4";
  }

  if (extension === "aac") {
    return "audio/aac";
  }

  if (extension === "mp3") {
    return "audio/mpeg";
  }

  if (extension === "ogg") {
    return "audio/ogg";
  }

  if (extension === "wav") {
    return "audio/wav";
  }

  return normalized;
}

function isSupportedWhatsAppAttachment(file: File) {
  const normalized = getAttachmentMimeType(file);
  return (
    supportedImageMimeTypes.includes(normalized) ||
    supportedVideoMimeTypes.includes(normalized) ||
    isSupportedWhatsAppAudio(normalized) ||
    supportedDocumentMimeTypes.includes(normalized)
  );
}

function getMediaKind(file: Pick<File, "name" | "type">) {
  const normalized = getAttachmentMimeType(file);

  if (supportedAudioMimeTypes.includes(normalized) || convertibleAudioMimeTypes.includes(normalized)) {
    return "audio";
  }

  if (supportedImageMimeTypes.includes(normalized)) {
    return "image";
  }

  if (supportedVideoMimeTypes.includes(normalized)) {
    return "video";
  }

  return "document";
}

async function prepareAttachmentForWhatsApp(file: File) {
  const normalized = getAttachmentMimeType(file);
  const typedFile = file.type.split(";")[0].trim().toLowerCase() === normalized
    ? file
    : new File([new Uint8Array(await file.arrayBuffer())], file.name || "archivo", { type: normalized });

  if (convertibleAudioMimeTypes.includes(normalized)) {
    return convertWavToMp3File(typedFile);
  }

  if (supportedImageMimeTypes.includes(normalized)) {
    return normalizeImageOrientation(typedFile);
  }

  return typedFile;
}

async function normalizeImageOrientation(file: File) {
  const sharp = (await import("sharp")).default;
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await sharp(inputBuffer).rotate().toBuffer();
  const outputBytes = new Uint8Array(outputBuffer);

  return new File([outputBytes], file.name || "imagen", { type: file.type });
}

async function convertWavToMp3File(file: File) {
  const wav = parseWavPcm16(await file.arrayBuffer());
  const encoder = createMp3Encoder(wav.sampleRate);
  const mp3Chunks: Uint8Array[] = [];

  for (const chunk of wav.chunks) {
    for (let offset = 0; offset < chunk.length; offset += 1152) {
      const mp3Buffer = encoder.encodeBuffer(chunk.subarray(offset, offset + 1152));

      if (mp3Buffer.length > 0) {
        mp3Chunks.push(new Uint8Array(mp3Buffer));
      }
    }
  }

  const finalBuffer = encoder.flush();

  if (finalBuffer.length > 0) {
    mp3Chunks.push(new Uint8Array(finalBuffer));
  }

  if (!mp3Chunks.length) {
    throw new Error("No pudimos convertir el audio grabado.");
  }

  const filename = (file.name || "audio-febo.wav").replace(/\.[^.]+$/, ".mp3");
  const blobParts = mp3Chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.length);
    copy.set(chunk);
    return copy.buffer;
  });

  return new File(blobParts, filename, { type: "audio/mpeg" });
}

function createMp3Encoder(sampleRate: number) {
  const runtimeGlobal = globalThis as typeof globalThis & {
    BitStream?: unknown;
    Lame?: unknown;
    MPEGMode?: unknown;
  };

  runtimeGlobal.MPEGMode ??= require("lamejs/src/js/MPEGMode.js");
  runtimeGlobal.Lame ??= require("lamejs/src/js/Lame.js");
  runtimeGlobal.BitStream ??= require("lamejs/src/js/BitStream.js");

  const { Mp3Encoder } = require("lamejs") as typeof import("lamejs");
  return new Mp3Encoder(1, sampleRate, 128);
}

function parseWavPcm16(arrayBuffer: ArrayBuffer) {
  const view = new DataView(arrayBuffer);

  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new Error("Audio WAV invalido.");
  }

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    }

    if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataLength = chunkLength;
    }

    offset = chunkDataOffset + chunkLength + (chunkLength % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || !channels || !sampleRate || !dataOffset || !dataLength) {
    throw new Error("Audio WAV no compatible.");
  }

  const frameCount = Math.floor(dataLength / (channels * 2));
  const mono = new Int16Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;

    for (let channel = 0; channel < channels; channel += 1) {
      sum += view.getInt16(dataOffset + (frame * channels + channel) * 2, true);
    }

    mono[frame] = Math.max(-32768, Math.min(32767, Math.round(sum / channels)));
  }

  const chunks: Int16Array[] = [];

  for (let index = 0; index < mono.length; index += 4096) {
    chunks.push(mono.subarray(index, index + 4096));
  }

  return { chunks, sampleRate };
}

function readAscii(view: DataView, offset: number, length: number) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }

  return value;
}

function buildAttachmentBody(file: Pick<File, "name" | "type">, caption?: string) {
  const mediaKind = getMediaKind(file);

  if (caption) {
    return caption;
  }

  if (mediaKind === "audio") {
    return "Audio enviado";
  }

  if (mediaKind === "image") {
    return `Imagen enviada: ${file.name || "imagen"}`;
  }

  if (mediaKind === "video") {
    return `Video enviado: ${file.name || "video"}`;
  }

  return `Archivo enviado: ${file.name || "archivo"}`;
}

function getSendValidationError(error: z.ZodError) {
  const fileErrors = error.flatten().fieldErrors.file ?? [];

  if (fileErrors.length) {
    return "Formato no compatible con WhatsApp o archivo demasiado grande. Proba con imagen, video MP4/3GP, PDF, Office o audio M4A/AAC/MP3/OGG compatible.";
  }

  return "Mensaje invalido.";
}
