create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'vendedor')),
  login_code_hash text,
  sales_group boolean not null default false,
  sales_priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_users
  add column if not exists login_code_hash text;

alter table app_users
  add column if not exists sales_group boolean not null default false,
  add column if not exists sales_priority integer not null default 100;

insert into app_users (full_name, email, role, sales_group, sales_priority)
values
  ('Guillermo Sandler', 'guille.aol@gmail.com', 'admin', false, 100),
  ('Rodrigo Fernandez', 'fernandezn.rodrigo@gmail.com', 'vendedor', true, 10)
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role,
    sales_group = excluded.sales_group,
    sales_priority = excluded.sales_priority,
    active = true,
    updated_at = now();

create table if not exists channel_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  channel text not null check (channel in ('whatsapp', 'instagram', 'facebook', 'tiktok')),
  external_account_id text,
  phone_number text,
  auto_reply_enabled boolean not null default false,
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists channel_accounts_channel_external_idx
  on channel_accounts(channel, external_account_id)
  where external_account_id is not null;

insert into channel_accounts (slug, name, channel, auto_reply_enabled, active)
values
  ('whatsapp-principal', 'WhatsApp principal Febecos', 'whatsapp', true, true),
  ('whatsapp-revendedores', 'WhatsApp revendedores', 'whatsapp', false, false)
on conflict (slug) do update
set name = excluded.name,
    channel = excluded.channel,
    auto_reply_enabled = excluded.auto_reply_enabled,
    updated_at = now();

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  account_id uuid references channel_accounts(id) on delete set null,
  external_user_id text,
  display_name text,
  platform text not null default 'whatsapp',
  contact_type text not null default 'prospecto',
  sentiment text not null default 'neutral',
  consultype text not null default 'otro',
  source text,
  assigned_to uuid references app_users(id) on delete set null,
  imported_from text,
  imported_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contacts
  add column if not exists account_id uuid references channel_accounts(id) on delete set null,
  add column if not exists external_user_id text;

update contacts
set account_id = coalesce(account_id, (select id from channel_accounts where slug = 'whatsapp-principal' limit 1)),
    external_user_id = coalesce(external_user_id, phone)
where platform = 'whatsapp';

create index if not exists contacts_account_idx on contacts(account_id);
create index if not exists contacts_platform_idx on contacts(platform);
create unique index if not exists contacts_account_external_user_idx
  on contacts(account_id, platform, external_user_id)
  where account_id is not null and external_user_id is not null;

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  account_id uuid references channel_accounts(id) on delete set null,
  channel text not null default 'whatsapp',
  status text not null default 'open' check (status in ('open', 'waiting', 'quoted', 'hot', 'handoff', 'closed', 'lost', 'blocked', 'deleted')),
  ai_enabled boolean not null default true,
  unread boolean not null default false,
  assigned_to uuid references app_users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations
  add column if not exists unread boolean not null default false;

alter table conversations
  add column if not exists account_id uuid references channel_accounts(id) on delete set null,
  add column if not exists channel text not null default 'whatsapp';

update conversations c
set account_id = coalesce(c.account_id, ct.account_id),
    channel = coalesce(nullif(c.channel, ''), ct.platform, 'whatsapp')
from contacts ct
where ct.id = c.contact_id;

alter table conversations
  drop constraint if exists conversations_status_check;

alter table conversations
  add constraint conversations_status_check
  check (status in ('open', 'waiting', 'quoted', 'hot', 'handoff', 'closed', 'lost', 'blocked', 'deleted'));

create unique index if not exists conversations_one_active_per_contact
  on conversations(contact_id)
  where status in ('open', 'waiting', 'quoted', 'hot', 'handoff');

create index if not exists conversations_last_message_idx on conversations(last_message_at desc);
create index if not exists conversations_assigned_to_idx on conversations(assigned_to);
create index if not exists conversations_account_channel_idx on conversations(account_id, channel, last_message_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  account_id uuid references channel_accounts(id) on delete set null,
  channel text not null default 'whatsapp',
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  wa_message_id text,
  external_message_id text,
  external_parent_id text,
  external_post_id text,
  body text not null,
  consultype text,
  needs_human boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table messages
  add column if not exists account_id uuid references channel_accounts(id) on delete set null,
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists external_message_id text,
  add column if not exists external_parent_id text,
  add column if not exists external_post_id text;

update messages m
set account_id = coalesce(m.account_id, c.account_id),
    channel = coalesce(nullif(m.channel, ''), c.channel, 'whatsapp'),
    external_message_id = coalesce(m.external_message_id, m.wa_message_id)
from conversations c
where c.id = m.conversation_id;

create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at);
create unique index if not exists messages_wa_message_unique_idx on messages(wa_message_id) where wa_message_id is not null;
create index if not exists messages_account_channel_created_idx on messages(account_id, channel, created_at desc);
create unique index if not exists messages_account_external_message_idx
  on messages(account_id, channel, external_message_id)
  where account_id is not null and external_message_id is not null;

create table if not exists conversation_memory (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  summary text not null default '',
  technical_facts jsonb not null default '{}'::jsonb,
  commercial_facts jsonb not null default '{}'::jsonb,
  pending_questions jsonb not null default '[]'::jsonb,
  last_intent text,
  last_topic text,
  updated_through_message_id uuid references messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_memory_updated_idx on conversation_memory(updated_at desc);

create table if not exists message_media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  wa_media_id text,
  external_media_id text,
  mime_type text not null,
  filename text,
  file_size integer,
  sha256 text,
  storage_provider text not null default 'postgres',
  r2_key text,
  media_url text,
  data_base64 text,
  created_at timestamptz not null default now()
);

alter table message_media
  add column if not exists external_media_id text,
  add column if not exists storage_provider text not null default 'postgres',
  add column if not exists r2_key text,
  add column if not exists media_url text,
  alter column data_base64 drop not null;

create index if not exists message_media_message_idx on message_media(message_id);
create index if not exists message_media_r2_key_idx on message_media(r2_key) where r2_key is not null;

create table if not exists conversation_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  created_by uuid references app_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_notes_conversation_created_idx on conversation_notes(conversation_id, created_at);

create table if not exists quick_replies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shortcut text not null unique,
  availability text not null default 'global',
  body text not null,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quick_replies_shortcut_idx on quick_replies(shortcut);

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid references app_users(id) on delete set null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'assigned', 'resolved', 'cancelled')),
  assigned_to uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  phone text,
  due_at timestamptz not null,
  status text not null default 'proposed' check (status in ('proposed', 'pending', 'sent', 'cancelled')),
  reason text not null default '',
  source text not null default 'febo_ai',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_ups_status_due_idx on follow_ups(status, due_at);
create index if not exists follow_ups_conversation_idx on follow_ups(conversation_id, created_at desc);

create table if not exists platform_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  phone text,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  name text not null,
  language_code text not null default 'es_AR',
  category text not null default 'utility',
  body text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, language_code)
);

create table if not exists scheduled_template_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  template_id uuid not null references message_templates(id) on delete restrict,
  phone text not null,
  body_parameters jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  created_by uuid references app_users(id) on delete set null,
  sent_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_template_messages_status_due_idx
  on scheduled_template_messages(status, scheduled_at);
create index if not exists scheduled_template_messages_conversation_idx
  on scheduled_template_messages(conversation_id, scheduled_at desc);

alter table scheduled_template_messages
  add column if not exists automation_rule_id uuid,
  add column if not exists automation_source text;

create index if not exists scheduled_template_messages_automation_idx
  on scheduled_template_messages(automation_rule_id, conversation_id, status)
  where automation_rule_id is not null;

create table if not exists template_automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  consultype text not null,
  template_id uuid not null references message_templates(id) on delete restrict,
  delay_amount integer not null default 1 check (delay_amount >= 0),
  delay_unit text not null default 'days' check (delay_unit in ('minutes', 'hours', 'days')),
  body_parameters jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists template_automation_rules_consultype_idx
  on template_automation_rules(consultype, active);

create table if not exists label_definitions (
  slug text primary key,
  name text not null,
  color text not null default '#38bdf8',
  instructions text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  label text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists outgoing_webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  secret text,
  events jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outgoing_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid references outgoing_webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  response_status integer,
  response_body text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists outgoing_webhooks_active_idx on outgoing_webhooks(active);
create index if not exists outgoing_webhook_deliveries_webhook_created_idx
  on outgoing_webhook_deliveries(webhook_id, created_at desc);

insert into app_settings (key, value, label, description)
values
  ('auto_reply_delay_seconds', '90'::jsonb, 'Demora de respuesta IA', 'Segundos que FEBO espera antes de responder automaticamente.'),
  ('hot_lead_default_assignee_id', 'null'::jsonb, 'Vendedor por defecto de calientes', 'Usuario asignado por defecto para leads calientes si no hay regla especifica.'),
  ('notification_sound', '{"sound":"chime","volume":0.55}'::jsonb, 'Sonido de notificaciones', 'Sonido y volumen global para notificaciones del inbox.'),
  ('notification_sound_users', '{}'::jsonb, 'Sonidos por usuario', 'Excepciones de sonido por usuario del inbox.'),
  ('whatsapp_selector_flow_id', '"890862800687247"'::jsonb, 'Flow ID del selector', 'Identificador publicado del WhatsApp Flow usado para abrir el selector.'),
  ('whatsapp_selector_flow_screen', '"DATOS_CAMPO"'::jsonb, 'Pantalla inicial del Flow', 'Screen ID inicial del WhatsApp Flow del selector.'),
  ('whatsapp_selector_flow_header', '"Selector Febecos"'::jsonb, 'Titulo del Flow', 'Texto de encabezado del mensaje interactivo del selector.'),
  ('whatsapp_selector_flow_body', '"Completa estos datos dentro de WhatsApp y te sugerimos el equipo de bombeo solar adecuado."'::jsonb, 'Texto del Flow', 'Cuerpo del mensaje que acompana el boton del selector.'),
  ('whatsapp_selector_flow_footer', '"Febecos bombas solares"'::jsonb, 'Pie del Flow', 'Footer del mensaje interactivo del selector.'),
  ('whatsapp_selector_flow_cta', '"Abrir selector"'::jsonb, 'Boton del Flow', 'Texto del boton que abre el selector.')
on conflict (key) do nothing;

insert into app_settings (key, value, label, description)
values ('whatsapp_selector_flow_id', '"890862800687247"'::jsonb, 'Flow ID del selector', 'Identificador publicado del WhatsApp Flow usado para abrir el selector.')
on conflict (key) do update
set value = case
      when app_settings.value = '""'::jsonb or app_settings.value = 'null'::jsonb then excluded.value
      else app_settings.value
    end,
    label = excluded.label,
    description = excluded.description,
    updated_at = now();

insert into label_definitions (slug, name, color, instructions, sort_order)
values
  ('caliente', 'Caliente', '#f43f5e', 'Cliente con intencion clara de compra o avance comercial. Debe priorizarse y, si esta asignado, verse en el CRM del vendedor.', 10),
  ('cliente', 'Cliente', '#42c767', 'Contacto que ya compro o debe tratarse como cliente activo.', 20),
  ('comparador', 'Comparador', '#fbbf24', 'Esta comparando opciones, precios o alternativas antes de decidir.', 30),
  ('contacto-de-bobbio', 'Contacto de Bobbio', '#38bdf8', 'Contacto derivado o vinculado a Bobbio.', 40),
  ('cotizado', 'Cotizado', '#16a34a', 'Ya recibio cotizacion o presupuesto.', 50),
  ('esperando-respuesta', 'Esperando Respuesta', '#f97316', 'Queda pendiente respuesta del cliente o seguimiento.', 60),
  ('fuera-de-horario', 'Fuera de Horario', '#f97316', 'Contacto atendido o entrante fuera del horario habitual.', 70),
  ('no-leido', 'No Leido', '#f97316', 'Debe llamar la atencion porque falta lectura/revision interna.', 80),
  ('pasar-presupuesto', 'Pasar Presupuesto', '#38bdf8', 'Requiere armado o envio de presupuesto.', 90),
  ('pocero-instalador', 'Pocero / instalador', '#38bdf8', 'Contacto tecnico, pocero, instalador o posible canal profesional.', 100),
  ('presupuesto-enviado', 'Presupuesto enviado', '#38bdf8', 'Ya se envio presupuesto formal.', 110),
  ('otro', 'Otro', '#94a3b8', 'Etiqueta neutra cuando no corresponde una categoria especifica.', 999)
on conflict (slug) do update
set name = excluded.name,
    color = excluded.color,
    instructions = case when label_definitions.instructions = '' then excluded.instructions else label_definitions.instructions end,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into message_templates (label, name, language_code, category, body)
values (
  'Hola inicial',
  'hello_world',
  'en_US',
  'utility',
  'Plantilla inicial de prueba de WhatsApp. Reemplazar por una plantilla aprobada propia de FEBECOS.'
)
on conflict (name, language_code) do nothing;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_users_updated_at on app_users;
create trigger set_app_users_updated_at
before update on app_users
for each row execute function set_updated_at();

drop trigger if exists set_contacts_updated_at on contacts;
create trigger set_contacts_updated_at
before update on contacts
for each row execute function set_updated_at();

drop trigger if exists set_conversations_updated_at on conversations;
create trigger set_conversations_updated_at
before update on conversations
for each row execute function set_updated_at();

drop trigger if exists set_conversation_memory_updated_at on conversation_memory;
create trigger set_conversation_memory_updated_at
before update on conversation_memory
for each row execute function set_updated_at();

drop trigger if exists set_message_templates_updated_at on message_templates;
create trigger set_message_templates_updated_at
before update on message_templates
for each row execute function set_updated_at();

drop trigger if exists set_scheduled_template_messages_updated_at on scheduled_template_messages;
create trigger set_scheduled_template_messages_updated_at
before update on scheduled_template_messages
for each row execute function set_updated_at();

drop trigger if exists set_template_automation_rules_updated_at on template_automation_rules;
create trigger set_template_automation_rules_updated_at
before update on template_automation_rules
for each row execute function set_updated_at();

drop trigger if exists set_label_definitions_updated_at on label_definitions;
create trigger set_label_definitions_updated_at
before update on label_definitions
for each row execute function set_updated_at();

drop trigger if exists set_app_settings_updated_at on app_settings;
create trigger set_app_settings_updated_at
before update on app_settings
for each row execute function set_updated_at();

drop trigger if exists set_outgoing_webhooks_updated_at on outgoing_webhooks;
create trigger set_outgoing_webhooks_updated_at
before update on outgoing_webhooks
for each row execute function set_updated_at();

drop trigger if exists set_quick_replies_updated_at on quick_replies;
create trigger set_quick_replies_updated_at
before update on quick_replies
for each row execute function set_updated_at();

-- 2026-06-04: soft delete and reply threading
alter table messages
  add column if not exists deleted_at timestamptz,
  add column if not exists reply_to_message_id uuid references messages(id) on delete set null;
