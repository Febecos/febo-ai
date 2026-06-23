import { getSql, isDbConfigured } from "./db";

/**
 * Productor del BUS DE EVENTOS central (Pilar 2 del OBJETIVO-99, dueño DEV Gestión).
 * Tabla `eventos` en la Neon central compartida. INSERT fire-and-forget e idempotente
 * (idempotency_key estable → re-emitir no duplica). Nunca rompe el flujo de negocio.
 *
 * origen fijo = 'febo-ai'. Tipos canónicos (D2): 'lead.creado', 'cotizacion.creada',
 * 'pago.comprobante_detectado', 'cliente.actualizado', 'escalacion', etc.
 *
 * Se mantiene EN PARALELO a los webhooks HTTP existentes hasta que el equipo corte.
 */
export async function emitEvento(input: {
  tipo: string;
  entidad?: string | null;
  entidadId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}): Promise<void> {
  if (!isDbConfigured()) {
    return;
  }
  try {
    await getSql()`
      insert into eventos (tipo, origen, entidad, entidad_id, payload, idempotency_key)
      values (
        ${input.tipo},
        'febo-ai',
        ${input.entidad ?? null},
        ${input.entidadId ?? null},
        ${JSON.stringify(input.payload ?? {})}::jsonb,
        ${input.idempotencyKey ?? null}
      )
      on conflict (idempotency_key) do nothing
    `;
  } catch {
    // bus best-effort: si falla, el flujo de negocio sigue igual.
  }
}
