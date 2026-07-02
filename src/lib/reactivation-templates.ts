/**
 * Campaña de reactivación de leads jul-2026 (spec Guille 02/07, coordinador OBJETIVO-99).
 * Definición ÚNICA de las 3 plantillas de Meta + las 6 etiquetas. La reusan la Tarea 2
 * (alta de plantillas + etiquetas) y la Tarea 3 (motor de envío).
 *
 * ⚠️ SOLO se envían por el número con API oficial de Meta (Cloud API). PROHIBIDO el bridge QR.
 * Categoría MARKETING · idioma es_AR. Los textos los aprueba Guille (cambios via coordinador).
 */

export type ReactivationTemplate = {
  name: string;
  language: string;
  category: "MARKETING";
  // Texto del BODY (los saltos de párrafo ya convertidos). {{1}}, {{2}}, ... = variables.
  body: string;
  // Cantidad de variables + ejemplos (Meta EXIGE ejemplos para aprobar).
  variables: string[]; // descripción de cada var, en orden (doc para nosotros)
  example: string[];   // valores de ejemplo, mismo orden
};

export const REACTIVATION_TEMPLATES: ReactivationTemplate[] = [
  {
    name: "reactivacion_consulta_2026",
    language: "es_AR",
    category: "MARKETING",
    variables: ["nombre", "agente", "uso"],
    example: ["Juan", "Rodrigo", "riego de hacienda"],
    body:
      "Hola {{1}} 👋 Soy {{2}} de Febecos. Hace un tiempo nos consultaste por un kit de bombeo solar para {{3}} y quedó pendiente.\n\n" +
      "Te escribo por algo puntual: ahora tenemos 6 cuotas con tarjeta a tasa baja, algo que no existía cuando consultaste. El kit completo llega con todo incluido: bomba, paneles, controlador, soportes, cables y soga.\n\n" +
      "¿Seguís con el proyecto de asegurar el agua o lo resolviste por otro lado? Contame y te paso los números actualizados sin compromiso.\n\n" +
      "Si preferís que no te escriba más, respondé BAJA y listo."
  },
  {
    name: "reactivacion_cotizados_2026",
    language: "es_AR",
    category: "MARKETING",
    variables: ["nombre", "agente", "kit", "mes_consulta", "fecha_limite", "cuota"],
    example: ["Juan", "Rodrigo", '3" 300W', "junio", "31/07", "185.000"],
    body:
      "Hola {{1}}, soy {{2}} de Febecos. Tengo acá tu consulta del kit {{3}} de {{4}}.\n\n" +
      "Te aviso dos cosas antes de que arranque la temporada: te actualicé la propuesta a los números de hoy y podés congelar ESTE precio hasta el {{5}}; además hoy lo sacás en 6 cuotas de ${{6}} con tarjeta.\n\n" +
      "Con la primavera se dispara la demanda de agua para hacienda y los tiempos de entrega se estiran. ¿Querés que te pase la propuesta actualizada?"
  },
  {
    name: "seguimiento_reactivacion_2026",
    language: "es_AR",
    category: "MARKETING",
    variables: ["nombre"],
    example: ["Juan"],
    body:
      '{{1}}, te escribo por última vez para no molestarte 🙂 Si el tema del agua quedó para más adelante, no hay problema — decime "más adelante" y te vuelvo a escribir en primavera, antes de la seca.\n\n' +
      "Si lo resolviste por otro lado, también me sirve saberlo. Y si querés los números en cuotas, respondé CUOTAS y te los mando en el momento."
  }
];

// Las 6 etiquetas de la campaña (se crean si no existen). slug + nombre + color + instrucción IA.
export const REACTIVATION_LABELS: Array<{ slug: string; name: string; color: string; instructions: string }> = [
  { slug: "react-cuotas", name: "React · Cuotas", color: "#16a34a", instructions: "Respondió CUOTAS a la campaña de reactivación: quiere los números en cuotas. Asignar a Rodrigo." },
  { slug: "react-mas-adelante", name: "React · Más adelante", color: "#f59e0b", instructions: "Respondió 'más adelante' a la reactivación: retomar en primavera. NO insistir ahora." },
  { slug: "react-resuelto-otro-lado", name: "React · Resuelto", color: "#94a3b8", instructions: "Dijo que resolvió el tema del agua por otro lado. No reactivar." },
  { slug: "react-precio", name: "React · Precio", color: "#38bdf8", instructions: "Pidió precio/propuesta en la campaña de reactivación." },
  { slug: "react-sin-respuesta", name: "React · Sin respuesta", color: "#64748b", instructions: "Contactado en la reactivación, todavía sin responder. Candidato al follow-up día 4-5." },
  { slug: "react-baja", name: "React · BAJA", color: "#ef4444", instructions: "Respondió BAJA / pidió no recibir más mensajes. EXCLUSIÓN PERMANENTE de futuras tandas." }
];
