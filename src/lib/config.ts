import { z } from "zod";

const schema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.1"),
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().optional(),
  INTERNAL_LOGIN_CODE: z.string().optional(),
  FEBO_OWNER_CONFIRMATION_CODE: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_SELECTOR_FLOW_ID: z.string().optional(),
  WHATSAPP_SELECTOR_FLOW_SCREEN: z.string().default("DATOS_CAMPO"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:guille.aol@gmail.com"),
  FEBECOS_API_BASE_URL: z.string().url().optional(),
  FEBECOS_API_TOKEN: z.string().optional(),
  FEBECOS_WEBHOOK_TOKEN: z.string().optional(),
  INTERNAL_SERVICE_SECRET: z.string().optional(),
  FEBECOS_PUBLIC_URL: z.string().url().default("https://febecos.com"),
  FEBECOS_HUMAN_SUPPORT_LABEL: z.string().default("Equipo FEBECOS"),
  FEBECOS_SELECTOR_API_BASE_URL: z.string().url().default("https://selector.febecos.com/api"),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),
  CLOUDFLARE_R2_PUBLIC_BASE_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("Febecos Ventas <ventas@febecos.com>"),
  PAYMENT_NOTIFY_TO: z.string().default("administracion@febecos.com"),
  // Si está en "true", el Purchase a Meta (registrar-venta) se manda con dry_run.
  // Para el primer test con Guille: prender → verificar en Events Manager → apagar.
  REGISTRAR_VENTA_DRY_RUN: z.string().optional()
});

export const config = schema.parse(process.env);

export function requireEnv(name: keyof typeof config) {
  const value = config[name];

  if (!value) {
    throw new Error(`Falta configurar ${name}`);
  }

  return value;
}
