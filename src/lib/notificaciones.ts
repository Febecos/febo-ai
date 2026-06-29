import { getSql, isDbConfigured } from "./db";
import { sendWhatsAppText } from "./whatsapp";

/**
 * CONSUMIDOR C1 — Aviso de estado de pedido por WhatsApp (OBJETIVO-99).
 *
 * Contrato: RONDA2-ESTADO-ACTUAL/CONTRATO-NOTIFICACIONES.md (Regla A, dueño DEV ENVIOS).
 * Evento que consumo del bus central: `pedido.estado_cambiado` (productor: Gestión).
 *   payload = { pedido_ref, estado_nuevo, cliente_id, telefono, email }
 *   estado_nuevo ∈ {aprobado|pagado|facturado|despachado|enviado|cancelado}
 *
 * Regla A: FEBO AI manda el WA SOLO si el cliente tiene conversación WhatsApp activa
 * (ventana de sesión 24hs vigente). Si manda, escribe en `notificaciones` (canal='wa');
 * Envíos consulta esa tabla y hace SKIP del email. Un solo canal por (pedido, transición).
 *
 * Patrón de consumo (bus): claim en `eventos_consumo` → procesar → marcar 'procesado'.
 * `notificaciones` la crea/posee Envíos: si todavía no existe, este consumidor NO actúa
 * (deja todo para el email de Envíos) y se auto-activa cuando la tabla aparezca.
 */

const CONSUMIDOR = "febo-ai-notif-estado";
// Avisos viejos no se mandan (el estado ya quedó atrás / Envíos ya habrá emaileado).
const FRESCURA_HORAS = 2;

type PedidoEstadoPayload = {
  pedido_ref?: string;
  estado_nuevo?: string;
  cliente_id?: number | string | null;
  telefono?: string | null;
  email?: string | null;
};

// Mensaje corto por transición (tono WhatsApp). Si el estado no está acá → no se manda.
function mensajeEstado(estado: string, ref: string): string | null {
  const r = ref ? ` ${ref}` : "";
  switch (estado) {
    case "aprobado":   return `¡Buenas! Tu pedido${r} fue aprobado ✅. Ya lo estamos preparando, cualquier duda escribinos por acá.`;
    case "pagado":     return `¡Recibimos el pago de tu pedido${r}! 🙌 Gracias. Seguimos con la preparación y te avisamos cuando se despache.`;
    case "facturado":  return `Tu pedido${r} ya fue facturado 🧾. En breve coordinamos el envío.`;
    case "despachado": return `¡Tu pedido${r} fue despachado! 📦 Ya está en camino. Cualquier consulta del envío, escribinos.`;
    case "enviado":    return `¡Tu pedido${r} salió para tu dirección! 🚚 Si necesitás el seguimiento, decinos.`;
    case "cancelado":  return `Tu pedido${r} fue cancelado. Si fue un error o querés retomarlo, escribinos por acá y lo vemos.`;
    default:           return null;
  }
}

async function notificacionesTableExists(): Promise<boolean> {
  const rows = (await getSql()`
    select 1 from information_schema.tables where table_name = 'notificaciones' limit 1
  `) as Array<unknown>;
  return rows.length > 0;
}

// ¿El cliente tiene conversación WhatsApp ACTIVA? = existe conversación (no cerrada/bloqueada)
// y el último mensaje ENTRANTE del cliente es < 24hs (ventana free-form de WhatsApp).
// Match por sufijo de teléfono (los formatos pueden diferir entre Gestión y el contacto).
async function conversacionWhatsappActiva(telefono: string): Promise<{
  conversationId: string;
  contactId: string;
  lastInboundWaId: string | null;
} | null> {
  const digits = telefono.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const suffix = `%${digits.slice(-8)}`;

  const rows = (await getSql()`
    select
      c.id::text as conversation_id,
      ct.id::text as contact_id,
      (select created_at from messages where conversation_id = c.id and direction = 'inbound' order by created_at desc limit 1) as last_inbound_at,
      (select wa_message_id from messages where conversation_id = c.id and direction = 'inbound' order by created_at desc limit 1) as last_inbound_wa_id
    from conversations c
    join contacts ct on ct.id = c.contact_id
    where ct.phone like ${suffix}
      and c.status not in ('closed', 'lost', 'blocked', 'deleted')
    order by c.last_message_at desc nulls last
    limit 1
  `) as Array<{ conversation_id: string; contact_id: string; last_inbound_at: string | null; last_inbound_wa_id: string | null }>;

  const row = rows[0];
  if (!row || !row.last_inbound_at) return null;
  const horas = (Date.now() - new Date(row.last_inbound_at).getTime()) / 1000 / 3600;
  if (horas >= 24) return null; // fuera de la ventana → no free-form → que lo tome el email de Envíos

  return { conversationId: row.conversation_id, contactId: row.contact_id, lastInboundWaId: row.last_inbound_wa_id };
}

/**
 * Corre en el cron de FEBO AI. Reclama los `pedido.estado_cambiado` nuevos, decide WA vs nada,
 * y marca cada evento como procesado. Best-effort: nunca tira; los errores quedan en eventos_consumo.
 */
export async function consumirPedidoEstadoCambiado(): Promise<{ ok: boolean; reason?: string; claimed?: number; sent?: number; results?: unknown[] }> {
  if (!isDbConfigured()) return { ok: false, reason: "db-no-configurada" };
  const sql = getSql();

  // Gate: si la tabla de Envíos no existe todavía, no actuamos (todo va por email). Auto-activa cuando exista.
  if (!(await notificacionesTableExists())) {
    return { ok: true, reason: "esperando-tabla-notificaciones (Envios)" };
  }

  // 1) Reclamar eventos nuevos para este consumidor.
  await sql`
    insert into eventos_consumo (consumidor, evento_id)
    select ${CONSUMIDOR}, e.id from eventos e
    where e.tipo = 'pedido.estado_cambiado'
      and not exists (select 1 from eventos_consumo c where c.consumidor = ${CONSUMIDOR} and c.evento_id = e.id)
    on conflict do nothing
  `;

  // 2) Pendientes (más nuevos primero, lote acotado).
  const pendientes = (await sql`
    select e.id, e.payload, e.created_at
    from eventos_consumo c
    join eventos e on e.id = c.evento_id
    where c.consumidor = ${CONSUMIDOR} and c.estado <> 'procesado'
    order by e.id desc
    limit 50
  `) as Array<{ id: number; payload: PedidoEstadoPayload; created_at: string }>;

  const results: Array<{ evento: number; estado?: string; canal: string; reason?: string }> = [];
  let sent = 0;

  for (const ev of pendientes) {
    try {
      const p = ev.payload ?? {};
      const ref = String(p.pedido_ref ?? "");
      const estado = String(p.estado_nuevo ?? "").toLowerCase();
      const telefono = p.telefono ? String(p.telefono) : null;
      const clienteId = p.cliente_id != null ? Number(p.cliente_id) : null;

      const viejoHoras = (Date.now() - new Date(ev.created_at).getTime()) / 1000 / 3600;
      const mensaje = mensajeEstado(estado, ref);

      let canal = "ninguno";
      let reason: string | undefined;

      if (viejoHoras > FRESCURA_HORAS) {
        reason = `evento-viejo (${viejoHoras.toFixed(1)}h)`;
      } else if (!mensaje) {
        reason = `estado-sin-mensaje (${estado})`;
      } else if (!telefono) {
        reason = "sin-telefono";
      } else {
        const activo = await conversacionWhatsappActiva(telefono);
        if (!activo) {
          reason = "sin-whatsapp-activo"; // → lo manda Envíos por email
        } else {
          // Mandamos el WA primero; solo si salió OK registramos en `notificaciones` (lo que el
          // email de Envíos consulta para hacer SKIP). Así `notificaciones` refleja lo realmente enviado.
          const res = await sendWhatsAppText(telefono, mensaje, activo.lastInboundWaId, { contactId: activo.contactId });
          const waId = (res as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? null;

          await sql`
            insert into notificaciones (cliente_id, tipo, referencia, pedido_ref, canal, dedup_key)
            values (${clienteId}, 'estado', ${estado}, ${ref}, 'wa', ${`estado:${ref}:${estado}:wa`})
            on conflict (dedup_key) do nothing
          `;

          // Reflejar el aviso en el inbox para que el operador lo vea.
          await sql`
            insert into messages (conversation_id, contact_id, direction, body, wa_message_id, metadata, created_at)
            values (${activo.conversationId}::uuid, ${activo.contactId}::uuid, 'outbound', ${mensaje}, ${waId},
                    ${JSON.stringify({ source: "notif-estado", pedido_ref: ref, estado })}::jsonb, now())
          `;
          await sql`update conversations set last_message_at = now(), updated_at = now() where id = ${activo.conversationId}::uuid`;

          canal = "wa";
          sent++;
        }
      }

      await sql`
        update eventos_consumo set estado = 'procesado', procesado_at = now()
        where consumidor = ${CONSUMIDOR} and evento_id = ${ev.id}
      `;
      results.push({ evento: ev.id, estado, canal, reason });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`
        update eventos_consumo set estado = 'error', intentos = intentos + 1, error = ${msg}
        where consumidor = ${CONSUMIDOR} and evento_id = ${ev.id}
      `.catch(() => {});
      results.push({ evento: ev.id, canal: "error", reason: msg });
    }
  }

  return { ok: true, claimed: pendientes.length, sent, results };
}
