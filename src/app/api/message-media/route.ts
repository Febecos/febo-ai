import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMessageMediaByMessageId } from "@/lib/crm";

const schema = z.object({
  messageId: z.string().uuid()
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = schema.safeParse({
    messageId: request.nextUrl.searchParams.get("messageId")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje invalido." }, { status: 400 });
  }

  const media = await getMessageMediaByMessageId(parsed.data.messageId);

  if (!media) {
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(media.data_base64, "base64"), {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-type": media.mime_type,
      "content-disposition": `inline; filename="${media.filename ?? "audio"}"`
    }
  });
}
