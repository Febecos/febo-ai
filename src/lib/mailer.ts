import { Resend } from "resend";
import { config } from "./config";

export type EmailAttachment = {
  filename: string;
  /** Contenido en base64 (sin prefijo data:) */
  content: string;
};

let resend: Resend | null = null;

function getResend() {
  if (resend) {
    return resend;
  }

  if (!config.RESEND_API_KEY) {
    return null;
  }

  resend = new Resend(config.RESEND_API_KEY);
  return resend;
}

/**
 * Envía un email interno vía Resend (el mismo transporte que usa todo el
 * ecosistema Febecos). Remitente por defecto ventas@febecos.com (RESEND_FROM).
 * Si falta RESEND_API_KEY, no rompe el flujo: loguea y sale.
 */
export async function sendInternalEmail(input: {
  to?: string;
  from?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const client = getResend();

  if (!client) {
    console.warn("[mailer] RESEND_API_KEY no configurado; no se envió el email interno.");
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: input.from ?? config.RESEND_FROM,
      to: input.to ?? config.PAYMENT_NOTIFY_TO,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content
      }))
    });

    if (error) {
      console.error("[mailer] Resend devolvió error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[mailer] No pudimos enviar el email interno por Resend.", error);
    return false;
  }
}
