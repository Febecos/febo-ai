import { getSql, isDbConfigured } from "./db";

/**
 * Productor del BUS DE EVENTOS central (Pilar 2 del OBJETIVO-99, dueño DEV Gestión).
 * Tabla `eventos` en la Neon central compartida. INSERT fire-and-forget e idempotente
 * (idempotency_key estable → re-emitir no duplica). Nunca rompe el flujo de negocio.
 *
 * origen fijo = 'febo-ai'. Tipos canónicos (D2): 'lead.creado', 'cotizacion.creada',
 * 'pago.comprobante_detectado', 'cliente.actualizado', 'conversacion.escalada', etc.
 *
 * cliente_id es columna top-level (DB Neon central, agregada por DEV Gestión 26/06):
 * poblala cuando tengas el clientes.id resuelto; es nullable.
 *
 * Se mantiene EN PARALELO a los webhooks HTTP existentes hasta que el equipo corte.
 */
export async function emitEvento(input: {
  tipo: string;
  entidad?: string | null;
  entidadId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  clienteId?: number | null;
}): Promise<void> {
  if (!isDbConfigured()) {
    return;
  }
  try {
    await getSql()`
      insert into eventos (tipo, origen, entidad, entidad_id, payload, idempotency_key, cliente_id)
      values (
        ${input.tipo},
        'febo-ai',
        ${input.entidad ?? null},
        ${input.entidadId ?? null},
        ${JSON.stringify(input.payload ?? {})}::jsonb,
        ${input.idempotencyKey ?? null},
        ${input.clienteId ?? null}
      )
      on conflict (idempotency_key) do nothing
    `;
  } catch {
    // bus best-effort: si falla, el flujo de negocio sigue igual.
  }
}
