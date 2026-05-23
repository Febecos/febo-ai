import { getSql, isDbConfigured } from "./db";

export type AppUser = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "vendedor";
  sales_group: boolean;
};

export type AuthUserRecord = AppUser & {
  login_code_hash: string | null;
};

export type UserAdminSummary = AppUser & {
  active: boolean;
  has_login_code: boolean;
  sales_priority: number;
};

export type ConversationSummary = {
  id: string;
  status: string;
  ai_enabled: boolean;
  last_message_at: string;
  contact_id: string;
  phone: string;
  display_name: string | null;
  platform: string;
  sentiment: string;
  consultype: string;
  assigned_to: string | null;
  assigned_name: string | null;
  last_message: string | null;
  last_direction: string | null;
  unread_count: number;
  unread: boolean;
};

export type ContactSummary = {
  id: string;
  phone: string;
  display_name: string | null;
  platform: string;
  contact_type: string;
  sentiment: string;
  consultype: string;
  assigned_to: string | null;
  assigned_name: string | null;
  source: string | null;
  imported_from: string | null;
  last_seen_at: string;
  conversation_id: string | null;
  conversation_status: string | null;
};

export type MessageTemplate = {
  id: string;
  label: string;
  name: string;
  language_code: string;
  category: string;
  body: string;
  active: boolean;
};

export type QuickReply = {
  id: string;
  name: string;
  shortcut: string;
  availability: string;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  body: string;
  consultype: string | null;
  needs_human: boolean;
  created_at: string;
  wa_message_id: string | null;
  whatsapp_status: string | null;
  whatsapp_error: string | null;
  source: string | null;
  reply_options: Array<{ id: string; title: string }>;
  media_id: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  created_by: string | null;
  created_by_name: string | null;
};

export type ConversationNote = {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

export type AgentConversationMessage = {
  direction: "inbound" | "outbound" | "internal";
  body: string;
  consultype: string | null;
  needs_human: boolean;
  created_at: string;
  source: string | null;
};

export type ConversationMemory = {
  conversation_id: string;
  summary: string;
  technical_facts: Record<string, unknown>;
  commercial_facts: Record<string, unknown>;
  pending_questions: string[];
  last_intent: string | null;
  last_topic: string | null;
  updated_through_message_id: string | null;
  updated_at: string;
};

export type SelectorCheckoutLead = {
  origen: "selector";
  evento: "checkout_abierto";
  tipo_kit: "base" | "completo";
  codigo: string;
  url_slug?: string | null;
  marca?: string | null;
  watts?: number | null;
  precio_total: number;
  precio_base_kit?: number | null;
  extra_cable?: number | null;
  cuota_mensual?: number | null;
  cuotas_cant?: number | null;
  metros_cable?: number | null;
  metros_soga?: number | null;
  metros_sensor?: number | null;
  zona?: string | null;
  altura?: number | null;
  litros?: number | null;
  diametro?: number | null;
  whatsapp_cliente: string;
  timestamp?: string | null;
  _es_test?: boolean;
};

export type ConversationFilters = {
  query?: string;
  consultype?: string;
  status?: string;
  assignedTo?: string;
  limit?: number;
};

export type ContactFilters = {
  query?: string;
  limit?: number;
};

export const seedUsers = [
  {
    full_name: "Guillermo Sandler",
    email: "guille.aol@gmail.com",
    role: "admin"
  },
  {
    full_name: "Rodrigo Fernandez",
    email: "fernandezn.rodrigo@gmail.com",
    role: "vendedor"
  }
] as const;

const hotLeadAssigneeEmail = "fernandezn.rodrigo@gmail.com";

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function normalizeWhatsAppRecipient(phone: string) {
  const digits = normalizePhone(phone);

  if (digits.startsWith("549")) {
    return digits;
  }

  if (digits.startsWith("54")) {
    const local = digits.slice(2);
    return local.startsWith("9") ? digits : `549${local}`;
  }

  if (digits.startsWith("0")) {
    return `549${digits.slice(1)}`;
  }

  if (digits.length === 10 || digits.startsWith("11")) {
    return `549${digits}`;
  }

  return digits;
}

export function normalizeConsultype(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

  if (!normalized) {
    return "otro";
  }

  if (normalized === "comprador") {
    return "caliente";
  }

  if (normalized === "proyecto-futuro" || normalized === "sin-perforacion") {
    return normalized;
  }

  const allowed = new Set([
    "saludo",
    "informacion",
    "disponibilidad",
    "accion",
    "problema",
    "seguimiento",
    "caliente",
    "cliente",
    "comparador",
    "contacto-de-bobbio",
    "cotizado",
    "esperando-respuesta",
    "fuera-de-horario",
    "no-leido",
    "pasar-presupuesto",
    "pocero-instalador",
    "presupuesto-enviado",
    "reserva-7-dias",
    "tecnico-revendedor",
    "otro"
  ]);

  return allowed.has(normalized) ? normalized : "otro";
}

export function normalizeSentiment(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "muy-positivo" || normalized === "positivo") {
    return "positivo";
  }

  if (normalized === "negativo") {
    return "preocupado";
  }

  if (normalized === "muy-negativo" || normalized === "molesto") {
    return "molesto";
  }

  return "neutral";
}

export async function findUserByEmail(email: string) {
  if (!isDbConfigured()) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    select id, full_name, email, role, sales_group, login_code_hash
    from app_users
    where lower(email) = lower(${email}) and active = true
    limit 1
  `) as AuthUserRecord[];

  return rows[0] ?? null;
}

export async function getUsers() {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  return (await sql`
    select id, full_name, email, role, sales_group
    from app_users
    where active = true
    order by sales_group desc, role, full_name
  `) as AppUser[];
}

async function getHotLeadAssigneeId() {
  const sql = getSql();
  const rows = (await sql`
    select id::text
    from app_users
    where active = true and sales_group = true
    order by sales_priority, created_at, full_name
    limit 1
  `) as Array<{ id: string }>;

  if (rows[0]?.id) {
    return rows[0].id;
  }

  const fallback = (await sql`
    select id::text
    from app_users
    where lower(email) = lower(${hotLeadAssigneeEmail}) and active = true
    limit 1
  `) as Array<{ id: string }>;

  return fallback[0]?.id ?? null;
}

export async function getAdminUsers() {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  return (await sql`
    select id, full_name, email, role, sales_group, sales_priority, active, (login_code_hash is not null) as has_login_code
    from app_users
    order by active desc, sales_group desc, sales_priority, role, full_name
  `) as UserAdminSummary[];
}

export async function listMessageTemplates() {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  return (await sql`
    select id::text, label, name, language_code, category, body, active
    from message_templates
    order by active desc, label
  `) as MessageTemplate[];
}

export async function getMessageTemplate(templateId: string) {
  if (!isDbConfigured()) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    select id::text, label, name, language_code, category, body, active
    from message_templates
    where id = ${templateId}
    limit 1
  `) as MessageTemplate[];

  return rows[0] ?? null;
}

export async function upsertMessageTemplate(input: {
  id?: string;
  label: string;
  name: string;
  languageCode: string;
  category: string;
  body: string;
  active: boolean;
}) {
  const sql = getSql();
  const id = input.id || null;
  const rows = (await sql`
    insert into message_templates (id, label, name, language_code, category, body, active)
    values (
      coalesce(${id}::uuid, gen_random_uuid()),
      ${input.label},
      ${input.name},
      ${input.languageCode},
      ${input.category},
      ${input.body},
      ${input.active}
    )
    on conflict (name, language_code) do update
    set label = excluded.label,
        category = excluded.category,
        body = excluded.body,
        active = excluded.active,
        updated_at = now()
    returning id::text, label, name, language_code, category, body, active
  `) as MessageTemplate[];

  return rows[0];
}

export async function upsertMessageTemplates(
  templates: Array<{
    label: string;
    name: string;
    languageCode: string;
    category: string;
    body: string;
    active: boolean;
  }>
) {
  const saved: MessageTemplate[] = [];

  for (const template of templates) {
    saved.push(await upsertMessageTemplate(template));
  }

  return saved;
}

export async function listQuickReplies() {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  return (await sql`
    select
      q.id::text,
      q.name,
      q.shortcut,
      q.availability,
      q.body,
      q.created_by::text,
      u.full_name as created_by_name,
      q.created_at::text,
      q.updated_at::text
    from quick_replies q
    left join app_users u on u.id = q.created_by
    order by q.name
  `) as QuickReply[];
}

export async function upsertQuickReply(input: {
  id?: string;
  name: string;
  shortcut: string;
  availability: string;
  body: string;
  userId: string;
}) {
  const sql = getSql();
  const id = input.id || null;
  const shortcut = input.shortcut.trim().replace(/^\/+/, "").toLowerCase();

  const rows = (await sql`
    insert into quick_replies (id, name, shortcut, availability, body, created_by)
    values (
      coalesce(${id}::uuid, gen_random_uuid()),
      ${input.name.trim()},
      ${shortcut},
      ${input.availability.trim().toLowerCase() || "global"},
      ${input.body.trim()},
      ${input.userId}
    )
    on conflict (shortcut) do update
    set name = excluded.name,
        availability = excluded.availability,
        body = excluded.body,
        created_by = excluded.created_by,
        updated_at = now()
    returning id::text
  `) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

export async function deleteQuickReply(id: string) {
  if (!isDbConfigured()) {
    return;
  }

  const sql = getSql();
  await sql`delete from quick_replies where id = ${id}`;
}

export async function upsertAppUser(input: {
  id?: string;
  fullName: string;
  email: string;
  role: "admin" | "vendedor";
  salesGroup: boolean;
  salesPriority?: number;
  active: boolean;
  loginCodeHash?: string | null;
}) {
  const sql = getSql();
  const id = input.id || null;
  const loginCodeHash = input.loginCodeHash ?? null;
  const shouldChangeCode = input.loginCodeHash !== undefined;
  const salesPriority = input.salesPriority ?? 100;

  const rows = (await sql`
    insert into app_users (id, full_name, email, role, sales_group, sales_priority, active, login_code_hash)
    values (
      coalesce(${id}::uuid, gen_random_uuid()),
      ${input.fullName},
      lower(${input.email}),
      ${input.role},
      ${input.salesGroup},
      ${salesPriority},
      ${input.active},
      ${loginCodeHash}
    )
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = excluded.role,
        sales_group = excluded.sales_group,
        sales_priority = excluded.sales_priority,
        active = excluded.active,
        login_code_hash = case when ${shouldChangeCode} then excluded.login_code_hash else app_users.login_code_hash end,
        updated_at = now()
    returning id, full_name, email, role, sales_group, sales_priority, active, (login_code_hash is not null) as has_login_code
  `) as UserAdminSummary[];

  return rows[0];
}

export async function recordIncomingMessage(input: {
  phone: string;
  waMessageId?: string;
  text: string;
  contactName?: string;
}) {
  if (!isDbConfigured()) {
    return { contactId: null, threadId: null, messageId: null, aiEnabled: false, duplicate: false };
  }

  const sql = getSql();

  if (input.waMessageId) {
    const existingMessage = (await sql`
      select
        m.id::text as message_id,
        c.id::text as thread_id,
        c.ai_enabled,
        ct.id::text as contact_id
      from messages m
      join conversations c on c.id = m.conversation_id
      left join contacts ct on ct.id = m.contact_id
      where m.wa_message_id = ${input.waMessageId}
      limit 1
    `) as Array<{ message_id: string; thread_id: string; ai_enabled: boolean; contact_id: string | null }>;

    if (existingMessage[0]) {
      return {
        contactId: existingMessage[0].contact_id,
        threadId: existingMessage[0].thread_id,
        messageId: existingMessage[0].message_id,
        aiEnabled: existingMessage[0].ai_enabled,
        duplicate: true
      };
    }
  }

  const phone = normalizePhone(input.phone);
  const contacts = (await sql`
    insert into contacts (phone, display_name, platform, last_seen_at)
    values (${phone}, ${input.contactName ?? null}, 'whatsapp', now())
    on conflict (phone) do update
    set display_name = coalesce(excluded.display_name, contacts.display_name),
        last_seen_at = now(),
        updated_at = now()
    returning id
  `) as Array<{ id: string }>;
  const contactId = contacts[0].id;

  const existing = (await sql`
    select id, ai_enabled
    from conversations
    where contact_id = ${contactId}
      and status in ('open', 'waiting', 'quoted', 'hot', 'handoff')
    order by last_message_at desc
    limit 1
  `) as Array<{ id: string; ai_enabled: boolean }>;

  const created =
    existing[0] ??
    (
      (await sql`
        insert into conversations (contact_id, status, last_message_at, ai_enabled)
        values (${contactId}, 'open', now(), true)
        returning id, ai_enabled
      `) as Array<{ id: string; ai_enabled: boolean }>
    )[0];
  const threadId = created.id;
  const aiEnabled = created.ai_enabled;

  const inserted = (await sql`
    insert into messages (conversation_id, contact_id, direction, wa_message_id, body)
    values (${threadId}, ${contactId}, 'inbound', ${input.waMessageId ?? null}, ${input.text})
    on conflict (wa_message_id) where wa_message_id is not null do nothing
    returning id::text
  `) as Array<{ id: string }>;

  if (!inserted[0] && input.waMessageId) {
    const existingMessage = (await sql`
      select id::text
      from messages
      where wa_message_id = ${input.waMessageId}
      limit 1
    `) as Array<{ id: string }>;

    return { contactId, threadId, messageId: existingMessage[0]?.id ?? null, aiEnabled, duplicate: true };
  }

  await sql`
    update conversations
    set last_message_at = now(),
        unread = true,
        updated_at = now()
    where id = ${threadId}
  `;

  return { contactId, threadId, messageId: inserted[0].id, aiEnabled, duplicate: false };
}

export async function recordSelectorCheckoutLead(input: SelectorCheckoutLead) {
  if (!isDbConfigured()) {
    return { contactId: null, threadId: null, messageId: null, duplicate: false };
  }

  const sql = getSql();
  const phone = normalizeWhatsAppRecipient(input.whatsapp_cliente);
  const eventId = `selector:${phone}:${input.codigo}:${input.timestamp ?? ""}`;
  const existingMessage = (await sql`
    select
      m.id::text as message_id,
      c.id::text as thread_id,
      ct.id::text as contact_id
    from messages m
    join conversations c on c.id = m.conversation_id
    join contacts ct on ct.id = m.contact_id
    where m.wa_message_id = ${eventId}
    limit 1
  `) as Array<{ message_id: string; thread_id: string; contact_id: string }>;

  if (existingMessage[0]) {
    return {
      contactId: existingMessage[0].contact_id,
      threadId: existingMessage[0].thread_id,
      messageId: existingMessage[0].message_id,
      duplicate: true
    };
  }

  const assigneeId = await getHotLeadAssigneeId();
  const body = formatSelectorCheckoutMessage(input);
  const payload = JSON.stringify({
    source: "selector",
    event: input.evento,
    selector_checkout: input
  });

  const contacts = (await sql`
    insert into contacts (phone, display_name, platform, consultype, sentiment, source, assigned_to, last_seen_at)
    values (${phone}, null, 'whatsapp', 'caliente', 'positivo', 'selector', ${assigneeId}::uuid, now())
    on conflict (phone) do update
    set consultype = 'caliente',
        sentiment = 'positivo',
        source = coalesce(contacts.source, 'selector'),
        assigned_to = coalesce(contacts.assigned_to, ${assigneeId}::uuid),
        last_seen_at = now(),
        updated_at = now()
    returning id::text
  `) as Array<{ id: string }>;

  const contactId = contacts[0].id;
  const existingConversation = (await sql`
    select id::text
    from conversations
    where contact_id = ${contactId}
      and status in ('open', 'waiting', 'quoted', 'hot', 'handoff')
    order by last_message_at desc
    limit 1
  `) as Array<{ id: string }>;

  const conversation =
    existingConversation[0] ??
    (
      (await sql`
        insert into conversations (contact_id, status, last_message_at, ai_enabled, assigned_to)
        values (${contactId}, 'handoff', now(), false, ${assigneeId}::uuid)
        returning id::text
      `) as Array<{ id: string }>
    )[0];

  const inserted = (await sql`
    insert into messages (conversation_id, contact_id, direction, wa_message_id, body, consultype, needs_human, metadata)
    values (${conversation.id}, ${contactId}, 'inbound', ${eventId}, ${body}, 'caliente', true, ${payload}::jsonb)
    returning id::text
  `) as Array<{ id: string }>;

  await sql`
    update conversations
    set status = 'handoff',
        ai_enabled = false,
        assigned_to = coalesce(assigned_to, ${assigneeId}::uuid),
        unread = true,
        last_message_at = now(),
        updated_at = now()
    where id = ${conversation.id}
  `;

  await sql`
    insert into platform_events (contact_id, phone, event, payload)
    values (${contactId}, ${phone}, 'selector_checkout_abierto', ${payload}::jsonb)
  `;

  await sql`
    insert into handoffs (conversation_id, contact_id, reason, status, assigned_to)
    values (${conversation.id}, ${contactId}, 'selector_checkout_abierto', 'assigned', ${assigneeId}::uuid)
  `;

  return {
    contactId,
    threadId: conversation.id,
    messageId: inserted[0]?.id ?? null,
    duplicate: false
  };
}

function formatSelectorCheckoutMessage(input: SelectorCheckoutLead) {
  const lines = [
    "Checkout desde selector Febecos",
    `Kit: ${input.tipo_kit}`,
    `Equipo: ${input.codigo}${input.marca ? ` - ${input.marca}` : ""}`,
    input.watts ? `Watts: ${input.watts}` : null,
    `Precio total: ${formatARS(input.precio_total)}`,
    input.precio_base_kit ? `Precio base kit: ${formatARS(input.precio_base_kit)}` : null,
    input.extra_cable ? `Extra cable: ${formatARS(input.extra_cable)}` : null,
    input.cuota_mensual ? `${input.cuotas_cant ?? 6} cuotas de: ${formatARS(input.cuota_mensual)}` : null,
    input.metros_cable ? `Cable sumergible: ${input.metros_cable}m` : null,
    input.metros_soga ? `Soga: ${input.metros_soga}m` : null,
    input.metros_sensor ? `Cable sensor: ${input.metros_sensor}m` : null,
    input.zona ? `Zona: ${input.zona}` : null,
    input.altura ? `Altura: ${input.altura}m` : null,
    input.litros ? `Consumo: ${input.litros} L/dia` : null,
    input.diametro ? `Diametro: ${input.diametro}"` : null,
    `WhatsApp cliente: ${input.whatsapp_cliente}`
  ].filter(Boolean);

  return lines.join("\n");
}

function formatARS(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

export async function updateMessageBody(messageId: string | null | undefined, body: string) {
  if (!isDbConfigured() || !messageId) {
    return;
  }

  const sql = getSql();

  await sql`
    update messages
    set body = ${body}
    where id = ${messageId}
  `;
}

export async function recordAgentReply(input: {
  contactId?: string | null;
  threadId?: string | null;
  answer: string;
  intent: string;
  needsHuman: boolean;
  waMessageId?: string | null;
  createHandoff?: boolean;
  replyOptions?: Array<{ id: string; title: string }>;
}) {
  if (!isDbConfigured() || !input.contactId || !input.threadId) {
    return;
  }

  const sql = getSql();
  const consultype = normalizeConsultype(input.intent);
  const humanAssigneeId = input.needsHuman || consultype === "caliente" ? await getHotLeadAssigneeId() : null;

  const metadata = input.replyOptions?.length
    ? JSON.stringify({ source: "febo_ai", reply_options: input.replyOptions })
    : JSON.stringify({ source: "febo_ai" });

  await sql`
    insert into messages (conversation_id, contact_id, direction, wa_message_id, body, consultype, needs_human, metadata)
    values (
      ${input.threadId},
      ${input.contactId},
      'outbound',
      ${input.waMessageId ?? null},
      ${input.answer},
      ${consultype},
      ${input.needsHuman},
      ${metadata}::jsonb
    )
  `;

  await sql`
    update contacts
    set consultype = ${consultype},
        assigned_to = coalesce(${humanAssigneeId}::uuid, assigned_to),
        updated_at = now()
    where id = ${input.contactId}
  `;

  await sql`
    update conversations
    set last_message_at = now(),
        ai_enabled = case when ${input.needsHuman} then false else ai_enabled end,
        status = case
          when ${input.needsHuman} then 'handoff'
          when ${consultype} = 'caliente' then 'hot'
          else status
        end,
        assigned_to = coalesce(${humanAssigneeId}::uuid, assigned_to),
        updated_at = now()
    where id = ${input.threadId}
  `;

  if (input.needsHuman && input.createHandoff !== false) {
    await sql`
      insert into handoffs (conversation_id, contact_id, reason, status, assigned_to)
      values (${input.threadId}, ${input.contactId}, ${input.intent}, 'assigned', ${humanAssigneeId}::uuid)
    `;
  }
}

export async function listConversations(filters: ConversationFilters = {}) {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  const query = filters.query?.trim() ?? "";
  const phoneQuery = normalizePhone(query);
  const search = query ? `%${query.toLowerCase()}%` : null;
  const phoneSearch = phoneQuery ? `%${phoneQuery}%` : null;
  const consultype = filters.consultype && filters.consultype !== "all" ? filters.consultype : null;
  const onlyAssigned = filters.status === "handoff";
  const status = filters.status && filters.status !== "all" && !onlyAssigned ? filters.status : null;
  const assignedTo =
    filters.assignedTo &&
    filters.assignedTo !== "all" &&
    filters.assignedTo !== "mine" &&
    filters.assignedTo !== "unassigned"
      ? filters.assignedTo
      : null;
  const onlyUnassigned = filters.assignedTo === "unassigned";
  const limit = Math.min(Math.max(filters.limit ?? 300, 20), 1000);

  return (await sql`
    select
      c.id,
      c.status,
      c.ai_enabled,
      c.unread,
      c.last_message_at::text,
      ct.id as contact_id,
      ct.phone,
      ct.display_name,
      ct.platform,
      ct.sentiment,
      ct.consultype,
      c.assigned_to::text,
      u.full_name as assigned_name,
      lm.body as last_message,
      lm.direction as last_direction,
      case when c.unread then 1 else 0 end::int as unread_count
    from conversations c
    join contacts ct on ct.id = c.contact_id
    left join app_users u on u.id = c.assigned_to
    left join lateral (
      select body, direction
      from messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ) lm on true
    where (${search}::text is null or lower(coalesce(ct.display_name, '')) like ${search} or ct.phone like ${phoneSearch})
      and (${consultype}::text is null or ct.consultype = ${consultype})
      and (${status}::text is null or c.status = ${status})
      and (${onlyAssigned}::boolean = false or c.assigned_to is not null)
      and (${assignedTo}::uuid is null or c.assigned_to = ${assignedTo}::uuid)
      and (${onlyUnassigned}::boolean = false or c.assigned_to is null)
      and (${status}::text is not null or c.status not in ('blocked', 'deleted'))
    order by c.last_message_at desc, c.created_at desc, ct.display_name asc nulls last, c.id
    limit ${limit}
  `) as ConversationSummary[];
}

export async function listContacts(filters: ContactFilters = {}) {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  const query = filters.query?.trim() ?? "";
  const phoneQuery = normalizePhone(query);
  const search = query ? `%${query.toLowerCase()}%` : null;
  const phoneSearch = phoneQuery ? `%${phoneQuery}%` : null;
  const limit = Math.min(Math.max(filters.limit ?? 300, 20), 1000);

  return (await sql`
    select
      ct.id::text,
      ct.phone,
      ct.display_name,
      ct.platform,
      ct.contact_type,
      ct.sentiment,
      ct.consultype,
      ct.assigned_to::text,
      u.full_name as assigned_name,
      ct.source,
      ct.imported_from,
      ct.last_seen_at::text,
      c.id::text as conversation_id,
      c.status as conversation_status
    from contacts ct
    left join app_users u on u.id = ct.assigned_to
    left join lateral (
      select id, status, last_message_at
      from conversations
      where contact_id = ct.id
      order by last_message_at desc
      limit 1
    ) c on true
    where (${search}::text is null or lower(coalesce(ct.display_name, '')) like ${search} or ct.phone like ${phoneSearch})
    order by coalesce(c.last_message_at, ct.last_seen_at) desc, ct.display_name asc nulls last, ct.phone
    limit ${limit}
  `) as ContactSummary[];
}

export async function updateContact(input: {
  contactId: string;
  displayName?: string | null;
  phone?: string;
  contactType?: string;
  sentiment?: string;
  consultype?: string;
  assignedTo?: string | null;
}) {
  if (!isDbConfigured()) {
    return null;
  }

  const sql = getSql();
  const phone = input.phone ? normalizeWhatsAppRecipient(input.phone) : null;
  const displayName = input.displayName?.trim() || null;
  const contactType = input.contactType?.trim().toLowerCase() || "prospecto";
  const sentiment = normalizeSentiment(input.sentiment);
  const consultype = normalizeConsultype(input.consultype);

  const rows = (await sql`
    update contacts
    set display_name = ${displayName},
        phone = coalesce(${phone}, phone),
        contact_type = ${contactType},
        sentiment = ${sentiment},
        consultype = ${consultype},
        assigned_to = ${input.assignedTo ?? null}::uuid,
        updated_at = now()
    where id = ${input.contactId}
    returning id::text
  `) as Array<{ id: string }>;

  if (input.assignedTo !== undefined) {
    await sql`
      update conversations
      set assigned_to = ${input.assignedTo ?? null}::uuid,
          updated_at = now()
      where contact_id = ${input.contactId}
        and status in ('open', 'waiting', 'quoted', 'hot', 'handoff')
    `;
  }

  return rows[0] ?? null;
}

export async function listConversationMessages(conversationId: string, limit = 120) {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 20), 500);

  return (await sql`
    select
      m.id::text,
      m.direction,
      m.body,
      m.consultype,
      m.needs_human,
      m.created_at::text,
      m.wa_message_id,
      m.metadata->>'whatsapp_status' as whatsapp_status,
      m.metadata->>'whatsapp_error' as whatsapp_error,
      m.metadata->>'source' as source,
      case
        when jsonb_typeof(m.metadata->'reply_options') = 'array' then m.metadata->'reply_options'
        else '[]'::jsonb
      end as reply_options,
      mm.id::text as media_id,
      mm.mime_type as media_mime_type,
      mm.filename as media_filename,
      m.created_by::text,
      u.full_name as created_by_name
    from messages m
    left join app_users u on u.id = m.created_by
    left join lateral (
      select id, mime_type, filename
      from message_media
      where message_id = m.id
      order by created_at desc
      limit 1
    ) mm on true
    where m.conversation_id = ${conversationId}
    order by m.created_at asc
    limit ${safeLimit}
  `) as ConversationMessage[];
}

export async function listConversationNotes(conversationId: string, limit = 80) {
  if (!isDbConfigured()) {
    return [];
  }

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 20), 200);

  const rows = await sql`
    select
      n.id::text,
      n.conversation_id::text,
      n.body,
      n.created_at::text,
      n.created_by::text,
      u.full_name as created_by_name
    from conversation_notes n
    left join app_users u on u.id = n.created_by
    where n.conversation_id = ${conversationId}
    order by n.created_at desc
    limit ${safeLimit}
  ` as ConversationNote[];

  return rows.reverse();
}

export async function createConversationNote(input: {
  conversationId: string;
  userId: string;
  body: string;
}) {
  if (!isDbConfigured()) {
    return;
  }

  const sql = getSql();
  await sql`
    insert into conversation_notes (conversation_id, created_by, body)
    values (${input.conversationId}, ${input.userId}, ${input.body})
  `;
}

export async function listAgentConversationContext(conversationId: string | null | undefined, limit = 30) {
  if (!isDbConfigured() || !conversationId) {
    return [];
  }

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 8), 80);

  return (await sql`
    select direction, body, consultype, needs_human, created_at::text, metadata->>'source' as source
    from (
      select direction, body, consultype, needs_human, created_at, metadata
      from messages
      where conversation_id = ${conversationId}
        and nullif(trim(body), '') is not null
      order by created_at desc
      limit ${safeLimit}
    ) recent
    order by created_at asc
  `) as AgentConversationMessage[];
}

export async function getConversationMemory(conversationId: string | null | undefined) {
  if (!isDbConfigured() || !conversationId) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    select
      conversation_id::text,
      summary,
      technical_facts,
      commercial_facts,
      pending_questions,
      last_intent,
      last_topic,
      updated_through_message_id::text,
      updated_at::text
    from conversation_memory
    where conversation_id = ${conversationId}
    limit 1
  `) as ConversationMemory[];

  return rows[0] ?? null;
}

export async function upsertConversationMemory(input: {
  conversationId: string | null | undefined;
  summary: string;
  technicalFacts: Record<string, unknown>;
  commercialFacts: Record<string, unknown>;
  pendingQuestions: string[];
  lastIntent?: string | null;
  lastTopic?: string | null;
  updatedThroughMessageId?: string | null;
}) {
  if (!isDbConfigured() || !input.conversationId) {
    return;
  }

  const sql = getSql();

  await sql`
    insert into conversation_memory (
      conversation_id,
      summary,
      technical_facts,
      commercial_facts,
      pending_questions,
      last_intent,
      last_topic,
      updated_through_message_id
    )
    values (
      ${input.conversationId},
      ${input.summary},
      ${JSON.stringify(input.technicalFacts)}::jsonb,
      ${JSON.stringify(input.commercialFacts)}::jsonb,
      ${JSON.stringify(input.pendingQuestions)}::jsonb,
      ${input.lastIntent ?? null},
      ${input.lastTopic ?? null},
      ${input.updatedThroughMessageId ?? null}
    )
    on conflict (conversation_id) do update
    set summary = excluded.summary,
        technical_facts = excluded.technical_facts,
        commercial_facts = excluded.commercial_facts,
        pending_questions = excluded.pending_questions,
        last_intent = excluded.last_intent,
        last_topic = excluded.last_topic,
        updated_through_message_id = excluded.updated_through_message_id,
        updated_at = now()
  `;
}

export async function getAutomaticReplyCandidate(input: {
  conversationId?: string | null;
  messageId?: string | null;
}) {
  if (!isDbConfigured() || !input.conversationId || !input.messageId) {
    return { shouldReply: true, combinedMessage: null as string | null };
  }

  const sql = getSql();
  const rows = (await sql`
    with target_message as (
      select id, created_at
      from messages
      where id = ${input.messageId}
        and conversation_id = ${input.conversationId}
        and direction = 'inbound'
      limit 1
    ),
    latest_inbound as (
      select id
      from messages
      where conversation_id = ${input.conversationId}
        and direction = 'inbound'
      order by created_at desc
      limit 1
    ),
    latest_message as (
      select direction
      from messages
      where conversation_id = ${input.conversationId}
      order by created_at desc
      limit 1
    ),
    last_outbound_before_target as (
      select max(created_at) as created_at
      from messages
      where conversation_id = ${input.conversationId}
        and direction in ('outbound', 'internal')
        and created_at < (select created_at from target_message)
    ),
    pending_inbound as (
      select body, created_at
      from messages
      where conversation_id = ${input.conversationId}
        and direction = 'inbound'
        and nullif(trim(body), '') is not null
        and created_at > coalesce((select created_at from last_outbound_before_target), '-infinity'::timestamptz)
      order by created_at asc
      limit 12
    )
    select
      exists(select 1 from target_message) as target_exists,
      (select id::text from latest_inbound) = ${input.messageId} as is_latest_inbound,
      (select direction from latest_message) = 'inbound' as latest_is_inbound,
      c.ai_enabled,
      (
        select string_agg(body, E'\n' order by created_at asc)
        from pending_inbound
      ) as combined_message
    from conversations c
    where c.id = ${input.conversationId}
    limit 1
  `) as Array<{
    target_exists: boolean;
    is_latest_inbound: boolean;
    latest_is_inbound: boolean;
    ai_enabled: boolean;
    combined_message: string | null;
  }>;

  const row = rows[0];

  if (!row) {
    return { shouldReply: false, combinedMessage: null };
  }

  return {
    shouldReply: row.target_exists && row.is_latest_inbound && row.latest_is_inbound && row.ai_enabled,
    combinedMessage: row.combined_message
  };
}

export async function getConversationReplyTarget(conversationId: string) {
  if (!isDbConfigured()) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    select
      c.id::text as conversation_id,
      c.contact_id::text,
      ct.phone
    from conversations c
    join contacts ct on ct.id = c.contact_id
    where c.id = ${conversationId}
    limit 1
  `) as Array<{ conversation_id: string; contact_id: string; phone: string }>;

  return rows[0] ?? null;
}

export async function upsertContactConversation(input: {
  phone: string;
  displayName?: string | null;
  userId?: string | null;
}) {
  const sql = getSql();
  const phone = normalizeWhatsAppRecipient(input.phone);
  const contacts = (await sql`
    insert into contacts (phone, display_name, platform, last_seen_at, source)
    values (${phone}, ${input.displayName ?? null}, 'whatsapp', now(), 'manual')
    on conflict (phone) do update
    set display_name = coalesce(nullif(excluded.display_name, ''), contacts.display_name),
        last_seen_at = now(),
        updated_at = now()
    returning id::text, phone, display_name
  `) as Array<{ id: string; phone: string; display_name: string | null }>;
  const contact = contacts[0];

  const existing = (await sql`
    select id::text
    from conversations
    where contact_id = ${contact.id}
      and status in ('open', 'waiting', 'quoted', 'hot', 'handoff')
    order by last_message_at desc
    limit 1
  `) as Array<{ id: string }>;

  const conversation =
    existing[0] ??
    (
      (await sql`
        insert into conversations (contact_id, status, last_message_at, ai_enabled, assigned_to)
        values (${contact.id}, 'open', now(), false, ${input.userId ?? null}::uuid)
        returning id::text
      `) as Array<{ id: string }>
    )[0];

  return {
    contactId: contact.id,
    conversationId: conversation.id,
    phone: contact.phone,
    displayName: contact.display_name
  };
}

export async function recordManualOutboundMessage(input: {
  conversationId: string;
  contactId: string;
  userId: string;
  body: string;
  waMessageId?: string | null;
  metadata?: Record<string, unknown>;
  preserveAiEnabled?: boolean;
}) {
  const sql = getSql();
  const metadata = {
    source: "manual",
    whatsapp_status: input.waMessageId ? "accepted" : undefined,
    ...(input.metadata ?? {})
  };

  const rows = (await sql`
    insert into messages (conversation_id, contact_id, direction, wa_message_id, body, created_by, metadata)
    values (
      ${input.conversationId},
      ${input.contactId},
      'outbound',
      ${input.waMessageId ?? null},
      ${input.body},
      ${input.userId},
      ${JSON.stringify(metadata)}::jsonb
    )
    returning id::text
  `) as Array<{ id: string }>;

  if (input.preserveAiEnabled) {
    await sql`
      update conversations
      set last_message_at = now(),
          updated_at = now()
      where id = ${input.conversationId}
    `;
  } else {
    await sql`
      update conversations
      set last_message_at = now(),
          ai_enabled = false,
          assigned_to = coalesce(assigned_to, ${input.userId}::uuid),
          updated_at = now()
      where id = ${input.conversationId}
    `;
  }

  return rows[0].id;
}

export async function recordWhatsAppMessageStatuses(
  statuses: Array<{
    id: string;
    recipientId?: string;
    status: string;
    timestamp?: string;
    errors?: Array<{ code?: number; title?: string; message?: string; details?: string }>;
  }>
) {
  if (!isDbConfigured() || !statuses.length) {
    return;
  }

  const sql = getSql();

  for (const status of statuses) {
    const error = status.errors?.[0];
    const errorText = [error?.title, error?.message, error?.details].filter(Boolean).join(" - ") || null;
    const payload = {
      whatsapp_status: status.status,
      whatsapp_status_at: status.timestamp ?? new Date().toISOString(),
      whatsapp_recipient_id: status.recipientId ?? null,
      whatsapp_error: errorText,
      whatsapp_error_code: error?.code ?? null
    };

    await sql`
      update messages
      set metadata = metadata || ${JSON.stringify(payload)}::jsonb
      where wa_message_id = ${status.id}
    `;
  }
}

export async function saveMessageMedia(input: {
  messageId: string;
  waMediaId?: string | null;
  mimeType: string;
  filename?: string | null;
  fileSize?: number | null;
  sha256?: string | null;
  dataBase64: string;
}) {
  const sql = getSql();

  const rows = (await sql`
    insert into message_media (message_id, wa_media_id, mime_type, filename, file_size, sha256, data_base64)
    values (
      ${input.messageId},
      ${input.waMediaId ?? null},
      ${input.mimeType},
      ${input.filename ?? null},
      ${input.fileSize ?? null},
      ${input.sha256 ?? null},
      ${input.dataBase64}
    )
    returning id::text
  `) as Array<{ id: string }>;

  return rows[0].id;
}

export async function getMessageMediaByMessageId(messageId: string) {
  if (!isDbConfigured()) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    select id::text, mime_type, filename, data_base64
    from message_media
    where message_id = ${messageId}
    order by created_at desc
    limit 1
  `) as Array<{ id: string; mime_type: string; filename: string | null; data_base64: string }>;

  return rows[0] ?? null;
}

export async function getDashboardStats() {
  if (!isDbConfigured()) {
    return {
      conversations: 0,
      contacts: 0,
      handoffs: 0,
      hot: 0
    };
  }

  const sql = getSql();
  const rows = (await sql`
    select
      (select count(*)::int from conversations) as conversations,
      (select count(*)::int from contacts) as contacts,
      (select count(*)::int from conversations where assigned_to is not null) as handoffs,
      (select count(*)::int from contacts where consultype = 'caliente') as hot
  `) as Array<{
      conversations: number;
      contacts: number;
      handoffs: number;
      hot: number;
    }>;

  return rows[0];
}

export async function updateConversation(input: {
  conversationId: string;
  status?: string;
  aiEnabled?: boolean;
  assignedTo?: string | null;
  consultype?: string;
  displayName?: string | null;
  unread?: boolean;
}) {
  const sql = getSql();
  const status = input.status ?? null;
  const aiEnabled = input.aiEnabled ?? null;
  const unread = input.unread ?? null;
  const assignedTo = input.assignedTo === undefined ? null : input.assignedTo;
  const changeAssigned = input.assignedTo !== undefined;
  const consultype = input.consultype ? normalizeConsultype(input.consultype) : null;
  const displayName = input.displayName === undefined ? undefined : input.displayName?.trim() || null;

  const previous = (await sql`
    select c.assigned_to::text as assigned_to, u.full_name as assigned_name
    from conversations c
    left join app_users u on u.id = c.assigned_to
    where c.id = ${input.conversationId}
    limit 1
  `) as Array<{ assigned_to: string | null; assigned_name: string | null }>;

  await sql`
    update conversations
    set status = coalesce(${status}, status),
        ai_enabled = coalesce(${aiEnabled}, ai_enabled),
        unread = coalesce(${unread}, unread),
        assigned_to = case when ${changeAssigned} then ${assignedTo}::uuid else assigned_to end,
        updated_at = now()
    where id = ${input.conversationId}
  `;

  if (changeAssigned) {
    await sql`
      update contacts ct
      set assigned_to = ${assignedTo}::uuid,
          updated_at = now()
      from conversations c
      where c.contact_id = ct.id
        and c.id = ${input.conversationId}
    `;
  }

  if (consultype) {
    await sql`
      update contacts ct
      set consultype = ${consultype},
          updated_at = now()
      from conversations c
      where c.contact_id = ct.id
        and c.id = ${input.conversationId}
    `;
  }

  if (displayName !== undefined) {
    await sql`
      update contacts ct
      set display_name = ${displayName},
          updated_at = now()
      from conversations c
      where c.contact_id = ct.id
        and c.id = ${input.conversationId}
    `;
  }

  if (!changeAssigned) {
    return { assignedChanged: false, assignedName: previous[0]?.assigned_name ?? null };
  }

  const next = (await sql`
    select c.assigned_to::text as assigned_to, u.full_name as assigned_name
    from conversations c
    left join app_users u on u.id = c.assigned_to
    where c.id = ${input.conversationId}
    limit 1
  `) as Array<{ assigned_to: string | null; assigned_name: string | null }>;

  return {
    assignedChanged: previous[0]?.assigned_to !== next[0]?.assigned_to,
    assignedName: next[0]?.assigned_name ?? null
  };
}
