import { getSql, isDbConfigured } from "./db";
import { normalizeWhatsAppRecipient } from "./crm";
import { REACTIVATION_TEMPLATES, usoParaVariable, type ReactivationTemplate } from "./reactivation-templates";

/**
 * Motor de la campaña de reactivación jul-2026 (Tarea 3).
 * Toma el CSV que exporta DEV ADMIN (`export-leads-reactivacion.mjs`, separador `;` + BOM)
 * y arma, por fila: contacto normalizado + mensaje renderizado + flag de conversación previa
 * por WhatsApp (pedido de Guille 02/07, punto 4).
 *
 * Formatos de columnas de ADMIN (ver febecos-selector/scripts/export-leads-reactivacion.mjs):
 *   A_cotizados_recientes.csv: nombre;whatsapp;email;fecha;uso;bomba;kit;precio_cotizado;cuota_estimada;utm_source;utm_campaign
 *   B_generales.csv:           nombre;whatsapp;email;fecha;uso;bomba;precio_cotizado;utm_source;utm_campaign
 *   C_con_email.csv:           nombre;whatsapp;email;fecha;segmento;bomba;kit
 */

export type ReactivationSegment = "a" | "b" | "c";

export type ReactivationCsvRow = {
  nombre: string;
  whatsapp: string;
  email: string;
  uso: string;
  bomba: string;
  kit: string;
};

// El template a usar según segmento del CSV (a=cotizados, b=generales, c=con-email).
export function templateForSegment(segment: ReactivationSegment): ReactivationTemplate {
  const suffix = segment === "a" ? "react_a_cotizados_0726" : segment === "b" ? "react_b_general_0726" : "react_c_email_0726";
  const t = REACTIVATION_TEMPLATES.find((x) => x.name === suffix);
  if (!t) throw new Error(`Template no encontrado para segmento ${segment}`);
  return t;
}

// Parser CSV mínimo, separador `;`, con soporte de comillas (mismo escape que toCSV de ADMIN)
// y BOM. No usa librerías externas — el archivo lo genera un script propio, formato controlado.
export function parseReactivationCsv(raw: string): ReactivationCsvRow[] {
  const text = raw.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  function splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ";") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iNombre = idx("nombre");
  const iWhatsapp = idx("whatsapp");
  const iEmail = idx("email");
  const iUso = idx("uso");
  const iBomba = idx("bomba");
  const iKit = idx("kit");

  const rows: ReactivationCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const whatsapp = iWhatsapp >= 0 ? (cols[iWhatsapp] ?? "").trim() : "";
    if (!whatsapp) continue; // sin WhatsApp no aplica a esta campaña (va por email aparte)
    rows.push({
      nombre: iNombre >= 0 ? (cols[iNombre] ?? "").trim() : "",
      whatsapp,
      email: iEmail >= 0 ? (cols[iEmail] ?? "").trim() : "",
      uso: iUso >= 0 ? (cols[iUso] ?? "").trim() : "",
      bomba: iBomba >= 0 ? (cols[iBomba] ?? "").trim() : "",
      kit: iKit >= 0 ? (cols[iKit] ?? "").trim() : ""
    });
  }
  return rows;
}

function firstName(nombre: string): string {
  const trimmed = nombre.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

// Rellena {{1}}=nombre {{2}}=uso en el body de la plantilla, para PREVIEW humano (dry-run).
// El envío real a Meta manda los params por separado (sendWhatsAppTemplate), esto es solo texto legible.
export function renderReactivationMessage(template: ReactivationTemplate, row: ReactivationCsvRow): string {
  const nombre = firstName(row.nombre) || "vecino";
  const uso = usoParaVariable(row.uso || row.kit || row.bomba);
  return template.body.replace(/\{\{1\}\}/g, nombre).replace(/\{\{2\}\}/g, uso);
}

// Params en orden {{1}},{{2}} para sendWhatsAppTemplate (envío real).
export function reactivationBodyParameters(row: ReactivationCsvRow): string[] {
  return [firstName(row.nombre) || "vecino", usoParaVariable(row.uso || row.kit || row.bomba)];
}

const RECENT_CONTACT_DAYS = 45;

export type ConversationCheck = { existePrevia: boolean; ultimoContactoAt: string | null };

// Cruza un lote de teléfonos (formato 549...) contra conversaciones existentes de FEBO AI.
// "Previa" = hay conversación (cualquier status) con último mensaje (cualquier dirección) dentro
// de RECENT_CONTACT_DAYS días. Devuelve un mapa phone→check para decidir inclusión.
export async function checkExistingConversations(phones: string[]): Promise<Map<string, ConversationCheck>> {
  const result = new Map<string, ConversationCheck>();
  if (!isDbConfigured() || phones.length === 0) return result;

  const sql = getSql();
  const rows = (await sql`
    select ct.phone,
           max(coalesce(c.last_message_at, c.created_at)) as ultimo
    from contacts ct
    join conversations c on c.contact_id = ct.id
    where ct.phone = any(${phones})
    group by ct.phone
  `) as Array<{ phone: string; ultimo: string | null }>;

  for (const row of rows) {
    const ultimo = row.ultimo;
    const dias = ultimo ? (Date.now() - new Date(ultimo).getTime()) / 1000 / 3600 / 24 : Infinity;
    result.set(row.phone, { existePrevia: dias < RECENT_CONTACT_DAYS, ultimoContactoAt: ultimo });
  }
  return result;
}

export type ReactivationPreviewRow = {
  nombre: string;
  whatsapp: string;
  email: string | null;
  uso: string;
  mensaje: string;
  conversacionPrevia: boolean;
  ultimoContactoAt: string | null;
  incluido: boolean; // false si se excluiría por conversación previa reciente
};

// Arma el preview (dry-run) de un lote de filas: normaliza teléfono, renderiza mensaje,
// cruza contra conversaciones existentes. NO envía nada ni escribe en la DB.
export async function buildReactivationPreview(
  rows: ReactivationCsvRow[],
  template: ReactivationTemplate
): Promise<ReactivationPreviewRow[]> {
  const normalized = rows.map((r) => ({ ...r, whatsapp: normalizeWhatsAppRecipient(r.whatsapp) }));
  const phones = normalized.map((r) => r.whatsapp);
  const checks = await checkExistingConversations(phones);

  return normalized.map((row) => {
    const check = checks.get(row.whatsapp) ?? { existePrevia: false, ultimoContactoAt: null };
    return {
      nombre: firstName(row.nombre) || row.nombre,
      whatsapp: row.whatsapp,
      email: row.email || null,
      uso: usoParaVariable(row.uso || row.kit || row.bomba),
      mensaje: renderReactivationMessage(template, row),
      conversacionPrevia: check.existePrevia,
      ultimoContactoAt: check.ultimoContactoAt,
      incluido: !check.existePrevia
    };
  });
}
