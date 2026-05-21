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

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
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

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'waiting', 'quoted', 'hot', 'handoff', 'closed', 'lost', 'blocked', 'deleted')),
  ai_enabled boolean not null default true,
  assigned_to uuid references app_users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  wa_message_id text,
  body text not null,
  consultype text,
  needs_human boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at);
create unique index if not exists messages_wa_message_unique_idx on messages(wa_message_id) where wa_message_id is not null;

create table if not exists message_media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  wa_media_id text,
  mime_type text not null,
  filename text,
  file_size integer,
  sha256 text,
  data_base64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists message_media_message_idx on message_media(message_id);

create table if not exists conversation_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  created_by uuid references app_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_notes_conversation_created_idx on conversation_notes(conversation_id, created_at);

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

drop trigger if exists set_message_templates_updated_at on message_templates;
create trigger set_message_templates_updated_at
before update on message_templates
for each row execute function set_updated_at();
