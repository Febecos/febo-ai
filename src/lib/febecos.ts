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

// ── Transportistas — consulta pública a selector.febecos.com ─────────────────

export type TransportistaContacto = {
  type: "phone" | "whatsapp" | "email" | "web" | "address" | "other";
  value: string;
  label: string | null;
  is_primary: boolean;
};

export type TransportistaZona = {
  province: string;
  locality: string | null;
  coverage_type: "province_wide" | "locality_specific" | "zone_label";
  confidence: "alta" | "media" | "baja" | "manual";
  historical_uses: number;
};

export type TransportistaRow = {
  id: number;
  slug: string;
  nombre: string;
  activo: boolean;
  contactos: TransportistaContacto[];
  provincias: string[];
  zonas_detalle: TransportistaZona[];
  notas: string | null;
  source: string;
};

export type LocalidadRow = {
  id: string;
  name: string;
  province: string;
  municipality?: string;
  category?: string;
};

/** Busca transportistas por provincia y opcionalmente localidad.
 *  Llama a selector.febecos.com/api/transportistas (endpoint público GET). */
export async function searchTransportistas(
  provincia: string,
  localidad?: string
): Promise<ConnectorResult<TransportistaRow[]>> {
  const base = config.FEBECOS_SELECTOR_API_BASE_URL;
  const qs = new URLSearchParams({ provincia });
  if (localidad) qs.set("localidad", localidad);
  try {
    const r = await fetch(`${base}/transportistas?${qs}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },           // caché 60s en Next.js
    });
    if (!r.ok) return { ok: false, configured: true, error: `selector respondio ${r.status}` };
    const d = await r.json() as { ok: boolean; rows?: TransportistaRow[]; error?: string };
    if (!d.ok) return { ok: false, configured: true, error: d.error ?? "error desconocido" };
    return { ok: true, configured: true, data: d.rows ?? [] };
  } catch (e) {
    return { ok: false, configured: true, error: (e as Error).message };
  }
}

/** Autocomplete de localidades desde selector.febecos.com/api/localidades. */
export async function searchLocalidades(
  q: string,
  provincia?: string
): Promise<ConnectorResult<LocalidadRow[]>> {
  const base = config.FEBECOS_SELECTOR_API_BASE_URL;
  const qs = new URLSearchParams({ q: q.trim() });
  if (provincia) qs.set("provincia", provincia);
  try {
    const r = await fetch(`${base}/localidades?${qs}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return { ok: false, configured: true, error: `localidades: ${r.status}` };
    const d = await r.json() as { ok: boolean; localidades?: LocalidadRow[]; error?: string };
    if (!d.ok) return { ok: false, configured: true, error: d.error ?? "error" };
    return { ok: true, configured: true, data: d.localidades ?? [] };
  } catch (e) {
    return { ok: false, configured: true, error: (e as Error).message };
  }
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
