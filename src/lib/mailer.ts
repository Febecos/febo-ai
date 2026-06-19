import nodemailer from "nodemailer";
import { config } from "./config";

export type EmailAttachment = {
  filename: string;
  /** Contenido en base64 (sin prefijo data:) */
  content: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = config.SMTP_HOST;
  const user = config.SMTP_USER;
  const pass = config.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(config.SMTP_PORT) || 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

/**
 * Envía un email interno vía SMTP (Neolo — la misma casilla que usa el resto del
 * ecosistema Febecos). El remitente es la casilla autenticada (SMTP_USER, ej.
 * ventas@febecos.com). Si faltan credenciales SMTP, no rompe el flujo: loguea y sale.
 */
export async function sendInternalEmail(input: {
  to?: string;
  from?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const tx = getTransporter();

  if (!tx) {
    console.warn("[mailer] SMTP no configurado (SMTP_HOST/USER/PASS); no se envió el email interno.");
    return false;
  }

  try {
    await tx.sendMail({
      from: input.from ?? `"${config.PAYMENT_NOTIFY_FROM_NAME}" <${config.SMTP_USER}>`,
      to: input.to ?? config.PAYMENT_NOTIFY_TO,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: "base64"
      }))
    });

    return true;
  } catch (error) {
    console.error("[mailer] No pudimos enviar el email interno por SMTP.", error);
    return false;
  }
}
