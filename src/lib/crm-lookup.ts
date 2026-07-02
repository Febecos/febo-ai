import { config } from "./config";

/**
 * READ-THROUGH al CRM central (Pilar 1 OBJETIVO-99 — dato único, febo-gestion `clientes`).
 * Pedido de Guille (02/07): si Guille completa/corrige un dato EN el CRM (email, condición
 * fiscal, tildes ✓Compró/✓Instalador/✓Pocero), el inbox de FEBO AI tiene que reflejarlo al
 * abrir el contacto — no quedarse con la copia local vieja.
 *
 * Regla de merge (spec del coordinador): para campos MAESTROS (nombre/razón social, CUIT,
 * condición fiscal, email, dirección, tipo, tags/tildes) GANA EL CRM CENTRAL; los campos
 * propios del canal (estado de conversación, notas del chat, etiquetas de clasificación de
 * FEBO) siguen siendo de FEBO AI — este módulo NO los toca.
 *
 * Consume `GET {GESTION}/clientes/:id` (endpoint de lectura de Gestión). Fire-and-forget /
 * best-effort: si Gestión no responde, el modal sigue mostrando la copia local sin romper nada.
 *
 * ⚠️ SEGURIDAD: ese GET de Gestión hoy NO tiene auth (registrado en SECURITY-AUDIT.md 02/07,
 * no es mi repo). Lo consumimos igual porque es el único endpoint de lectura disponible; cuando
 * Gestión lo gatee, hay que sumar el header correspondiente acá (mismo patrón que banks.ts).
 */

export type CrmClienteReadThrough = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  razonSocial: string | null;
  empresa: string | null;
  email: string | null;
  cuit: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  condicionFiscal: string | null;
  tipo: string | null;
  tags: string[]; // tildes del CRM: ✓Compró/✓Instalador/✓Pocero, etc.
};

export async function fetchClienteFromCrm(clienteId: number): Promise<CrmClienteReadThrough | null> {
  try {
    const res = await fetch(`${config.GESTION_API_BASE_URL}/clientes/${clienteId}`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; cliente?: Record<string, unknown> };
    if (!data.ok || !data.cliente) return null;
    const c = data.cliente;
    return {
      id: Number(c.id),
      nombre: (c.nombre as string) ?? null,
      apellido: (c.apellido as string) ?? null,
      razonSocial: (c.razon_social as string) ?? null,
      empresa: (c.empresa as string) ?? null,
      email: (c.email as string) ?? null,
      cuit: (c.cuit as string) ?? null,
      domicilio: (c.domicilio as string) ?? null,
      localidad: (c.localidad as string) ?? null,
      provincia: (c.provincia as string) ?? null,
      codigoPostal: (c.cod_postal as string) ?? null,
      condicionFiscal: (c.condicion_fiscal as string) ?? null,
      tipo: (c.tipo as string) ?? null,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : []
    };
  } catch {
    return null; // best-effort: nunca rompe el modal de contacto
  }
}
