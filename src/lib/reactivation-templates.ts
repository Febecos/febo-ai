/**
 * Campaña de reactivación de leads jul-2026.
 * Definición ÚNICA de las 3 plantillas de Meta + las 6 etiquetas. La reusan la Tarea 2
 * (alta de plantillas + etiquetas) y la Tarea 3 (motor de envío).
 *
 * ⚠️ SOLO se envían por el número con API oficial de Meta (Cloud API). PROHIBIDO el bridge QR.
 * Categoría MARKETING · idioma es_AR.
 *
 * VERSIÓN FINAL (02/07, resolución del coordinador con Guille): va la spec de DEV MARKETING
 * (SPEC-REACTIVACION-COPYS-GUION.md) — botones quick-reply para etiquetado 100% automático,
 * opt-out en el footer, firma "Rodrigo" fija. Corrección de Guille: SIN promesa de sostener
 * precio (el dólar se mueve) — sacada la frase "sostenido por 7 días" de react_a_cotizados_0726.
 * Los textos los aprueba Guille (cambios vía coordinador/DEV MARKETING).
 */

export type ReactivationTemplate = {
  name: string;
  language: string;
  category: "MARKETING";
  // Texto del BODY (los saltos de párrafo ya convertidos). {{1}}, {{2}}, ... = variables.
  body: string;
  // Footer fijo (sin variables, ≤60 chars) — opt-out.
  footer: string;
  // Botones de respuesta rápida (postback). Mapeo → etiqueta en la Tarea 3.
  quickReplyButtons: string[];
  // Cantidad de variables + ejemplos (Meta EXIGE ejemplos para aprobar).
  variables: string[]; // descripción de cada var, en orden (doc para nosotros)
  example: string[];   // valores de ejemplo, mismo orden
};

const REACTIVATION_FOOTER = "Para no recibir más mensajes, respondé BAJA";
const REACTIVATION_BUTTONS = ["Sí, me interesa", "Más adelante", "Ya lo resolví"];

export const REACTIVATION_TEMPLATES: ReactivationTemplate[] = [
  {
    name: "react_a_cotizados_0726",
    language: "es_AR",
    category: "MARKETING",
    footer: REACTIVATION_FOOTER,
    quickReplyButtons: REACTIVATION_BUTTONS,
    variables: ["nombre", "uso"],
    example: ["Juan", "darle agua a la hacienda"],
    body:
      "Hola {{1}} 👋 Soy Rodrigo, de Febecos. Hace un tiempo te cotizamos un kit de bombeo solar para {{2}}.\n\n" +
      "Te escribo por dos novedades: ahora hay *6 cuotas con tarjeta de crédito*, y si retomás te paso la cotización actualizada al precio de hoy.\n\n" +
      "¿Seguís con la idea de resolver el agua antes de la primavera?"
  },
  {
    name: "react_b_general_0726",
    language: "es_AR",
    category: "MARKETING",
    footer: REACTIVATION_FOOTER,
    quickReplyButtons: REACTIVATION_BUTTONS,
    variables: ["nombre", "uso"],
    example: ["Juan", "riego"],
    body:
      "Hola {{1}} 👋 Soy Rodrigo, de Febecos. En su momento consultaste por bombeo solar para {{2}} y quería retomar antes de que arranque la temporada fuerte de agua.\n\n" +
      "Novedad: ahora podés pagar el kit en *6 cuotas con tarjeta*. Si querés te armo una cotización al precio de hoy, sin compromiso.\n\n" +
      "¿Te sirve que te la pase?"
  },
  {
    name: "react_c_email_0726",
    language: "es_AR",
    category: "MARKETING",
    footer: REACTIVATION_FOOTER,
    quickReplyButtons: REACTIVATION_BUTTONS,
    variables: ["nombre", "uso"],
    example: ["Juan", "tu campo"],
    body:
      "Hola {{1}} 👋 Soy Rodrigo, de Febecos. Consultaste por bombeo solar para {{2}} y quería acercarte algo concreto: el *informe de retorno* — cuánto ahorrás por año contra el gasoil y en cuántos meses recuperás el kit (en general, menos de un año).\n\n" +
      "Te lo mando por email junto con la cotización al precio de hoy, ahora también en *6 cuotas con tarjeta*. ¿Te lo paso?"
  }
];

// Mapea el segmento del CSV de ADMIN al uso en frase natural (spec Marketing punto 18).
export function usoParaVariable(uso: string | null | undefined): string {
  const normalized = (uso ?? "").toLowerCase();
  if (normalized.includes("hacienda")) return "darle agua a la hacienda";
  if (normalized.includes("riego")) return "riego";
  return "tu campo";
}

// Mapeo botón→etiqueta (postback de Meta = el texto exacto del botón tocado).
export const REACTIVATION_BUTTON_LABEL_MAP: Record<string, string> = {
  "Más adelante": "react-mas-adelante",
  "Ya lo resolví": "react-resuelto-otro-lado"
  // "Sí, me interesa" NO mapea a etiqueta fija: sigue conversación (FEBO AI/Rodrigo),
  // se etiqueta según desenlace (react-precio, react-cuotas, etc.)
};

// Las 6 etiquetas de la campaña (se crean si no existen). slug + nombre + color + instrucción IA.
export const REACTIVATION_LABELS: Array<{ slug: string; name: string; color: string; instructions: string }> = [
  { slug: "react-cuotas", name: "React · Cuotas", color: "#16a34a", instructions: "Respondió CUOTAS a la campaña de reactivación: quiere los números en cuotas. Asignar a Rodrigo." },
  { slug: "react-mas-adelante", name: "React · Más adelante", color: "#f59e0b", instructions: "Respondió 'más adelante' a la reactivación: retomar en primavera. NO insistir ahora." },
  { slug: "react-resuelto-otro-lado", name: "React · Resuelto", color: "#94a3b8", instructions: "Dijo que resolvió el tema del agua por otro lado. No reactivar." },
  { slug: "react-precio", name: "React · Precio", color: "#38bdf8", instructions: "Pidió precio/propuesta en la campaña de reactivación." },
  { slug: "react-sin-respuesta", name: "React · Sin respuesta", color: "#64748b", instructions: "Contactado en la reactivación, todavía sin responder. Candidato al follow-up día 4-5." },
  { slug: "react-baja", name: "React · BAJA", color: "#ef4444", instructions: "Respondió BAJA / pidió no recibir más mensajes. EXCLUSIÓN PERMANENTE de futuras tandas." }
];
