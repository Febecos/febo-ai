import { config } from "./config";

type FebecosProfile = {
  id: string;
  name: string;
  type: string;
  status?: string;
  dashboardUrl?: string;
};

type ConnectorResult<T> =
  | { ok: true; configured: boolean; data: T }
  | { ok: false; configured: boolean; error: string };

async function febecosFetch<T>(path: string, init?: RequestInit): Promise<ConnectorResult<T>> {
  if (!config.FEBECOS_API_BASE_URL || !config.FEBECOS_API_TOKEN) {
    return {
      ok: false,
      configured: false,
      error: "El conector FEBECOS todavia no tiene FEBECOS_API_BASE_URL/FEBECOS_API_TOKEN."
    };
  }

  const response = await fetch(new URL(path, config.FEBECOS_API_BASE_URL), {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.FEBECOS_API_TOKEN}`,
      ...init?.headers
    }
  });

  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      error: `FEBECOS respondio ${response.status}`
    };
  }

  return { ok: true, configured: true, data: (await response.json()) as T };
}

export async function getProfileByPhone(phone: string): Promise<ConnectorResult<FebecosProfile | null>> {
  return febecosFetch<FebecosProfile | null>(`/api/contacts/by-phone?phone=${encodeURIComponent(phone)}`);
}

export async function createLead(input: {
  phone: string;
  name?: string;
  message: string;
  intent: string;
}): Promise<ConnectorResult<{ id: string }>> {
  return febecosFetch<{ id: string }>("/api/leads", {
    method: "POST",
    body: JSON.stringify({
      source: "whatsapp_agent",
      ...input
    })
  });
}

export async function createSupportTicket(input: {
  phone: string;
  subject: string;
  message: string;
  priority: "normal" | "high";
}): Promise<ConnectorResult<{ id: string; url?: string }>> {
  return febecosFetch<{ id: string; url?: string }>("/api/support/tickets", {
    method: "POST",
    body: JSON.stringify({
      channel: "whatsapp",
      ...input
    })
  });
}

export async function recordPlatformEvent(input: {
  phone: string;
  event: string;
  payload: unknown;
}): Promise<ConnectorResult<{ id: string }>> {
  return febecosFetch<{ id: string }>("/api/events", {
    method: "POST",
    body: JSON.stringify({
      source: "whatsapp_agent",
      ...input
    })
  });
}

export function platformFallbackContext() {
  return {
    publicUrl: config.FEBECOS_PUBLIC_URL,
    supportLabel: config.FEBECOS_HUMAN_SUPPORT_LABEL,
    capabilities: [
      "orientar sobre FEBECOS",
      "identificar socios, prospectos o consultas comerciales",
      "registrar leads",
      "crear tickets para seguimiento humano",
      "derivar conversaciones sensibles o no resueltas"
    ]
  };
}
