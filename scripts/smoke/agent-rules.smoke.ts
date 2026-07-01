/**
 * SMOKE TEST del comportamiento de Febo (determinístico, SIN llamar a la IA).
 * Corre antes de cada deploy: `npm run smoke`.
 *
 * Objetivo: que regresiones de comportamiento ya conocidas FALLEN EL BUILD, no al cliente.
 * Acá probamos las FUNCIONES PURAS que deciden el comportamiento. Las reglas que dependen
 * del LLM (prompt) no se pueden testear determinísticamente y NO se cubren acá.
 *
 * Caso estrella (bug 29/06): el cliente identifica un KIT PUBLICADO (anuncio, IMAGEN del
 * anuncio descrita por visión, o nombrándolo) → debemos resolver el slug del kit para
 * buscar su PRECIO y NO caer a "dimensionar". `extractSlugFromReferralText` es el corazón
 * de ese fix: extrae diámetro+watts de cualquier texto (anuncio o descripción de imagen).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSlugFromReferralText } from "../../src/lib/selector";
import { aiShouldReplyNow, type AiReplySchedule } from "../../src/lib/ai-schedule";

test("kit por IMAGEN del anuncio (descripción de visión) → slug del kit (bug 29/06)", () => {
  // Esta es la descripción real que generó la visión y que ANTES caía a dimensionar.
  const descImagen =
    '[El cliente envió una imagen. Contenido detectado: La imagen muestra un anuncio de un kit ' +
    'de bomba solar. Incluye una bomba de 3" con una potencia de 300W, un panel solar de 500/550W ' +
    'y especifica un caudal de 3000 L/Hora. También menciona "kit completo".]';
  assert.equal(extractSlugFromReferralText(descImagen), "kit-bomba-solar-3-300w-completo");
});

test("anuncio CTWA 4\" 500W → slug 4-500w", () => {
  assert.equal(
    extractSlugFromReferralText('Kit Full 4" 500W', "bomba solar sumergible"),
    "kit-bomba-solar-4-500w-completo"
  );
});

test("anuncio 1100W → 4-1100w (no mezclar potencias)", () => {
  assert.equal(extractSlugFromReferralText("Bomba solar 4 pulgadas 1100W"), "kit-bomba-solar-4-1100w-completo");
});

test('comillas tipográficas (3") se normalizan', () => {
  assert.equal(extractSlugFromReferralText('Kit bomba solar 3” 300W'), "kit-bomba-solar-3-300w-completo");
});

test("'3 pulgadas' textual también resuelve", () => {
  assert.equal(extractSlugFromReferralText("bomba de 3 pulgadas 300 watts"), "kit-bomba-solar-3-300w-completo");
});

test("sin diámetro o sin watts → null (no inventar kit)", () => {
  assert.equal(extractSlugFromReferralText("hola, precio de una bomba solar?"), null);
  assert.equal(extractSlugFromReferralText('bomba 3" sin potencia'), null);
  assert.equal(extractSlugFromReferralText("300W pero sin diámetro"), null);
  assert.equal(extractSlugFromReferralText(""), null);
});

// ── Horario semanal de la IA (zona AR = UTC-3, sin DST) ──────────────────────
// 2026-06-29 es LUNES. Config: lunes, atención humana 09:00–18:00.
const schedLunHumans: AiReplySchedule = {
  enabled: true, tz: "America/Argentina/Buenos_Aires",
  days: { mon: { mode: "humans_window", from: "09:00", to: "18:00" } }
};

test("horario: dentro de la franja de atención humana → IA NO responde", () => {
  // UTC 15:00 = AR 12:00 lunes → dentro de 09–18 → false
  assert.equal(aiShouldReplyNow(schedLunHumans, new Date("2026-06-29T15:00:00Z")), false);
});

test("horario: fuera de la franja humana → IA responde", () => {
  // UTC 23:00 = AR 20:00 lunes → fuera de 09–18 → true
  assert.equal(aiShouldReplyNow(schedLunHumans, new Date("2026-06-29T23:00:00Z")), true);
});

test("horario deshabilitado → siempre responde (no bloquea)", () => {
  assert.equal(aiShouldReplyNow({ ...schedLunHumans, enabled: false }, new Date("2026-06-29T15:00:00Z")), true);
});

test("horario: día sin config → responde por defecto", () => {
  // Martes sin entrada → default IA todo el día
  assert.equal(aiShouldReplyNow(schedLunHumans, new Date("2026-06-30T15:00:00Z")), true);
});

test("horario null → no bloquea", () => {
  assert.equal(aiShouldReplyNow(null, new Date("2026-06-29T15:00:00Z")), true);
});
