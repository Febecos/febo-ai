import { config } from "./config";

export type EmailAttachment = {
  filename: string;
  /** Contenido en base64 (sin prefijo data:) */
  content: string;
};

/**
 * Envía un email interno vía la API REST de Resend (sin dependencia npm).
 * Requiere RESEND_API_KEY en el entorno; si falta, no rompe el flujo: loguea y sale.
 * El dominio del remitente (febecos.com) debe estar verificado en Resend.
 */
export async function sendInternalEmail(input: {
  to?: string;
  from?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const apiKey = config.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[mailer] RESEND_API_KEY no configurado; no se envió el email interno.");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: input.from ?? config.PAYMENT_NOTIFY_FROM,
        to: input.to ?? config.PAYMENT_NOTIFY_TO,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments?.length ? input.attachments : undefined
      })
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[mailer] Resend respondió error:", res.status, detail);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[mailer] No pudimos enviar el email interno.", error);
    return false;
  }
}
