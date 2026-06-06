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
