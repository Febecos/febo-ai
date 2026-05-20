import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

type MetaResult =
  | { ok: true; data: unknown }
  | { ok: false; status?: number; error: string; data?: unknown };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? request.headers.get("x-internal-code");

  if (!config.INTERNAL_LOGIN_CODE || code !== config.INTERNAL_LOGIN_CODE) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const env = {
    verifyToken: Boolean(config.WHATSAPP_VERIFY_TOKEN),
    accessToken: Boolean(config.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: Boolean(config.WHATSAPP_PHONE_NUMBER_ID),
    businessAccountId: Boolean(config.WHATSAPP_BUSINESS_ACCOUNT_ID),
    appSecret: Boolean(config.WHATSAPP_APP_SECRET)
  };

  const phoneNumber = config.WHATSAPP_PHONE_NUMBER_ID && config.WHATSAPP_ACCESS_TOKEN
    ? await metaGet(
      `${config.WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating,name_status`
    )
    : null;

  const phoneNumbers = config.WHATSAPP_BUSINESS_ACCOUNT_ID && config.WHATSAPP_ACCESS_TOKEN
    ? await metaGet(
      `${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/phone_numbers?fields=id,display_phone_number,verified_name,name_status`
    )
    : null;

  const subscribedApps = config.WHATSAPP_BUSINESS_ACCOUNT_ID && config.WHATSAPP_ACCESS_TOKEN
    ? await metaGet(`${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`)
    : null;

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    webhookUrl: "https://febo-ai.vercel.app/api/whatsapp/webhook",
    env,
    meta: {
      phoneNumber,
      phoneNumbers,
      subscribedApps
    }
  });
}

export async function POST(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? request.headers.get("x-internal-code");

  if (!config.INTERNAL_LOGIN_CODE || code !== config.INTERNAL_LOGIN_CODE) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!config.WHATSAPP_BUSINESS_ACCOUNT_ID || !config.WHATSAPP_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Falta WABA ID o access token." }, { status: 400 });
  }

  const result = await metaPost(`${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`);

  return NextResponse.json({
    ok: result.ok,
    checkedAt: new Date().toISOString(),
    action: "subscribe_waba_app",
    result
  }, { status: result.ok ? 200 : 400 });
}

async function metaGet(path: string): Promise<MetaResult> {
  try {
    const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
    url.searchParams.set("access_token", config.WHATSAPP_ACCESS_TOKEN ?? "");

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: getMetaError(data),
        data
      };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido."
    };
  }
}

async function metaPost(path: string): Promise<MetaResult> {
  try {
    const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
    url.searchParams.set("access_token", config.WHATSAPP_ACCESS_TOKEN ?? "");

    const response = await fetch(url, {
      cache: "no-store",
      method: "POST"
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: getMetaError(data),
        data
      };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido."
    };
  }
}

function getMetaError(data: unknown) {
  const meta = data as { error?: { message?: string; type?: string; code?: number } };
  const message = meta.error?.message ?? "Meta no devolvio detalle.";
  const code = meta.error?.code ? ` (${meta.error.code})` : "";
  const type = meta.error?.type ? ` ${meta.error.type}` : "";

  return `${message}${type}${code}`;
}
