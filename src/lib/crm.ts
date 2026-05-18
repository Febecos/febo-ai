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
  sentiment: string;
  consultype: string;
  assigned_to: string | null;
  assigned_name: string | null;
  last_message: string | null;
  last_direction: string | null;
  unread_count: number;
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  body: string;
  consultype: string | null;
  needs_human: boolean;
  created_at: string;
  media_id: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
};

export type ConversationFilters = {
  query?: string;
  consultype?: string;
  status?: string;
  assignedTo?: string;
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
    "comparador",
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
    return { contactId: null, threadId: null, messageId: null, aiEnabled: false };
  }

  const sql = getSql();
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
        values (${contactId}, 'open', now())
        returning id, ai_enabled
      `) as Array<{ id: string; ai_enabled: boolean }>
    )[0];
  const threadId = created.id;
  const aiEnabled = created.ai_enabled;

  const inserted = (await sql`
    insert into messages (conversation_id, contact_id, direction, wa_message_id, body)
    values (${threadId}, ${contactId}, 'inbound', ${input.waMessageId ?? null}, ${input.text})
    returning id::text
  `) as Array<{ id: string }>;

  await sql`
    update conversations
    set last_message_at = now()
    where id = ${threadId}
  `;

  return { contactId, threadId, messageId: inserted[0].id, aiEnabled };
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
}) {
  if (!isDbConfigured() || !input.contactId || !input.threadId) {
    return;
  }

  const sql = getSql();
  const consultype = normalizeConsultype(input.intent);
  const hotLeadAssigneeId = consultype === "caliente" ? await getHotLeadAssigneeId() : null;

  await sql`
    insert into messages (conversation_id, contact_id, direction, body, consultype, needs_human)
    values (${input.threadId}, ${input.contactId}, 'outbound', ${input.answer}, ${consultype}, ${input.needsHuman})
  `;

  await sql`
    update contacts
    set consultype = ${consultype},
        assigned_to = coalesce(${hotLeadAssigneeId}::uuid, assigned_to),
        updated_at = now()
    where id = ${input.contactId}
  `;

  await sql`
    update conversations
    set last_message_at = now(),
        status = case
          when ${input.needsHuman} then 'handoff'
          when ${consultype} = 'caliente' then 'hot'
          else status
        end,
        assigned_to = coalesce(${hotLeadAssigneeId}::uuid, assigned_to),
        updated_at = now()
    where id = ${input.threadId}
  `;

  if (input.needsHuman) {
    await sql`
      insert into handoffs (conversation_id, contact_id, reason, status)
      values (${input.threadId}, ${input.contactId}, ${input.intent}, 'pending')
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
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  const assignedTo =
    filters.assignedTo && filters.assignedTo !== "all" && filters.assignedTo !== "mine" ? filters.assignedTo : null;
  const onlyUnassigned = filters.assignedTo === "unassigned";
  const limit = Math.min(Math.max(filters.limit ?? 300, 20), 1000);

  return (await sql`
    select
      c.id,
      c.status,
      c.ai_enabled,
      c.last_message_at::text,
      ct.id as contact_id,
      ct.phone,
      ct.display_name,
      ct.sentiment,
      ct.consultype,
      c.assigned_to::text,
      u.full_name as assigned_name,
      lm.body as last_message,
      lm.direction as last_direction,
      0::int as unread_count
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
      and (${assignedTo}::uuid is null or c.assigned_to = ${assignedTo}::uuid)
      and (${onlyUnassigned}::boolean = false or c.assigned_to is null)
    order by c.last_message_at desc, c.created_at desc, ct.display_name asc nulls last, c.id
    limit ${limit}
  `) as ConversationSummary[];
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
      mm.id::text as media_id,
      mm.mime_type as media_mime_type,
      mm.filename as media_filename
    from messages m
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

export async function recordManualOutboundMessage(input: {
  conversationId: string;
  contactId: string;
  userId: string;
  body: string;
}) {
  const sql = getSql();

  const rows = (await sql`
    insert into messages (conversation_id, contact_id, direction, body, created_by, metadata)
    values (
      ${input.conversationId},
      ${input.contactId},
      'outbound',
      ${input.body},
      ${input.userId},
      '{"source":"manual"}'::jsonb
    )
    returning id::text
  `) as Array<{ id: string }>;

  await sql`
    update conversations
    set last_message_at = now(),
        ai_enabled = false,
        assigned_to = coalesce(assigned_to, ${input.userId}::uuid),
        updated_at = now()
    where id = ${input.conversationId}
  `;

  return rows[0].id;
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
      (select count(*)::int from conversations where status = 'handoff') as handoffs,
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
}) {
  const sql = getSql();
  const status = input.status ?? null;
  const aiEnabled = input.aiEnabled ?? null;
  const assignedTo = input.assignedTo === undefined ? null : input.assignedTo;
  const changeAssigned = input.assignedTo !== undefined;

  await sql`
    update conversations
    set status = coalesce(${status}, status),
        ai_enabled = coalesce(${aiEnabled}, ai_enabled),
        assigned_to = case when ${changeAssigned} then ${assignedTo}::uuid else assigned_to end,
        updated_at = now()
    where id = ${input.conversationId}
  `;
}
