import { config } from "./config";

const selectorPumpSchema = {
  parse(input: unknown) {
    if (!input || typeof input !== "object") {
      throw new Error("El selector no devolvio una respuesta valida.");
    }

    const data = input as Record<string, unknown>;

    if (data.ok !== true || !data.sugerencia || typeof data.sugerencia !== "object") {
      throw new Error("El selector no encontro una bomba sugerida.");
    }

    return data as SelectorPumpResult;
  }
};

export type SelectorPumpResult = {
  ok: true;
  inputs?: {
    height?: number;
    liters?: number;
    diameter?: number;
    season?: string;
  };
  sugerencia: {
    codigo: string;
    url_slug?: string;
    marca?: string;
    tipo?: string;
    energia?: string;
    impulsor?: string;
    watts?: number;
    cant_paneles?: number;
    watts_panel?: number;
    diam_bomba?: string;
    diam_perf?: string;
    stock?: number;
    precio_full?: number;
    precio_base?: number;
    precio_6cuotas?: number | null;
    cuota_mensual?: number;
  };
  caudal_a_altura?: {
    invierno?: number;
    promedio?: number;
    verano?: number;
    litros_hora?: number;
  };
  cumple?: {
    altura?: boolean;
    caudal_estacion?: boolean;
    caudal_invierno?: boolean;
    margen_caudal_pct?: number;
  };
  opciones?: Array<{
    codigo: string;
    marca?: string;
    watts?: number;
    precio_full?: number;
    stock?: number;
    caudal_verano?: number;
    caudal_invierno?: number;
    cubre_invierno?: boolean;
  }>;
  es_fallback?: boolean;
  cobertura_pct?: number;
  cobertura_insuficiente?: boolean;
  nota?: string;
  link_calculadora_roi?: string;
};

export async function suggestPump(input: {
  heightMeters: number;
  litersPerDay: number;
  maxPumpDiameterInches: number;
  mode?: string | null;
}) {
  const search = new URLSearchParams({
    height: String(Math.max(input.heightMeters, 10)),
    liters: String(Math.max(Math.round(input.litersPerDay), 0)),
    diameter: String(input.maxPumpDiameterInches),
    season: "verano"
  });

  if (input.mode) {
    search.set("mode", input.mode);
  }

  const url = new URL(`suggest-pump?${search.toString()}`, ensureTrailingSlash(config.FEBECOS_SELECTOR_API_BASE_URL));
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`El motor selector respondio ${response.status}.`);
  }

  return selectorPumpSchema.parse(await response.json());
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

// ── Pump detail (curvas de rendimiento) ──────────────────────────────────────

export type PumpCurvePoint = {
  altura_m: number;
  litros_invierno: number;
  litros_promedio: number;
  litros_verano: number;
  litros_hora: number;
  cant_animales: number;
};

export type PumpDetailResult = {
  ok: true;
  bomba: {
    codigo: string;
    tipo?: string;
    energia?: string;
    impulsor?: string;
    marca?: string;
    diam_bomba?: string;
    diam_perf?: string;
    watts?: number;
    cant_paneles?: number;
    precio_full?: number | null;
    stock?: number | null;
  };
  curvas: PumpCurvePoint[];
};

/**
 * Obtiene el detalle de una bomba con curvas de rendimiento por altura.
 * Llama directamente a roi.febecos.com/api/pump-detail?codigo=X
 */
export async function fetchPumpDetail(codigo: string): Promise<PumpDetailResult | null> {
  try {
    const url = `https://roi.febecos.com/api/pump-detail?codigo=${encodeURIComponent(codigo)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    if (data.ok !== true || !data.curvas) return null;
    return data as PumpDetailResult;
  } catch {
    return null;
  }
}

// ── Catalog product (precio + componentes para primer mensaje publi) ─────────

export type CatalogProductResult = {
  ok: true;
  sugerencia: {
    codigo: string;
    url_slug?: string;
    watts?: number;
    cant_paneles?: number;
    watts_panel?: number;
    diam_bomba?: string;
    precio_full?: number;
    precio_6cuotas?: number | null;
    cuota_mensual?: number;
    marca?: string;
  };
};

export async function fetchCatalogBySlug(slug: string): Promise<CatalogProductResult | null> {
  try {
    const base = ensureTrailingSlash(config.FEBECOS_SELECTOR_API_BASE_URL);
    const url = `${base}catalog/${encodeURIComponent(slug)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    if (!data.sugerencia) return null;
    return data as CatalogProductResult;
  } catch {
    return null;
  }
}

export function extractSlugFromReferralText(headline?: string, body?: string): string | null {
  const text = `${headline ?? ""} ${body ?? ""}`;
  const lower = text.toLowerCase();

  let diam: string | null = null;
  if (lower.includes('6"') || lower.includes("6 pulgadas")) diam = "6";
  else if (lower.includes('4"') || lower.includes("4 pulgadas")) diam = "4";
  else if (lower.includes('3"') || lower.includes("3 pulgadas")) diam = "3";
  else if (lower.includes('2"') || lower.includes("2 pulgadas")) diam = "2";

  const wattsMatch = lower.match(/(\d{3,4})\s*w(?:att)?s?\b/);
  const watts = wattsMatch ? wattsMatch[1] : null;

  if (!diam || !watts) return null;
  return `kit-bomba-solar-${diam}-${watts}w-completo`;
}

export function formatCatalogContext(product: CatalogProductResult, slug: string): string {
  const s = product.sugerencia;
  const precio = s.precio_full
    ? `$${s.precio_full.toLocaleString("es-AR")}`
    : "no disponible";
  const paneles = s.cant_paneles ? `${s.cant_paneles} panel${s.cant_paneles > 1 ? "es" : ""} fotovoltaico${s.cant_paneles > 1 ? "s" : ""}` : "paneles fotovoltaicos";
  const wattsPanel = s.watts_panel ? ` ${s.watts_panel}W` : "";
  const link = `https://selector.febecos.com/catalogo-v2/${slug}`;
  return `catalogContext: Kit Full ${s.diam_bomba ?? ""} ${s.watts ?? ""}W | Precio: ${precio} | Incluye: bomba solar sumergible + ${paneles}${wattsPanel} + controlador MPPT + cables y accesorios | URL: ${link}`;
}

/**
 * Formatea las curvas de rendimiento de una bomba como tabla de texto legible por WhatsApp.
 * Ej:
 * Curva de caudal — Kit Bomba 3" 300W (HD-3SSC4.5-35-24-300)
 * Altura | Verano  | Promedio | Invierno | L/hora
 * 10 m   | 2.400 L | 1.800 L  | 1.200 L  | 100
 * ...
 */
export function formatPumpCurveText(detail: PumpDetailResult): string {
  const { bomba, curvas } = detail;
  if (!curvas || curvas.length === 0) return "";

  const header = `📊 *Curva de caudal — ${bomba.marca ?? ""} ${bomba.watts ?? ""}W (${bomba.codigo})*`;
  const cols = "Altura  | Verano    | Promedio  | Invierno";
  const sep  = "--------|-----------|-----------|----------";
  const rows = curvas.map((c) => {
    const alt = `${c.altura_m}m`.padEnd(7);
    const v   = `${c.litros_verano.toLocaleString("es-AR")} L/d`.padEnd(10);
    const p   = `${c.litros_promedio.toLocaleString("es-AR")} L/d`.padEnd(10);
    const i   = `${c.litros_invierno.toLocaleString("es-AR")} L/d`.padEnd(10);
    return `${alt} | ${v} | ${p} | ${i}`;
  });

  return [header, cols, sep, ...rows].join("\n");
}
