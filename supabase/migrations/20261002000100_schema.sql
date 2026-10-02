-- Sunny Client Portal: core schema.
-- Everything is scoped by client_id so new clients (e.g. OfficeHQ) need rows, not structure.

create type public.app_role as enum ('admin', 'staff', 'client');
create type public.flight_status as enum ('booked', 'proposed');
create type public.material_status as enum ('due', 'supplied'); -- "overdue" is derived, never stored
create type public.supplied_by as enum ('client', 'sunny');
create type public.report_kind as enum ('whatagraph', 'pcr', 'other');
create type public.doc_section as enum ('sops', 'specs', 'notes');
create type public.contact_org as enum ('sunny', 'client', 'vendor');

-- Stamps updated_at / updated_by on every write to a content table.
create function public.stamp_updated() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------- structure

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  timezone text not null default 'Australia/Brisbane',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (client_id, code),
  unique (id, client_id)
);

create table public.estates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  region_id uuid not null,
  code text not null,
  name text not null,
  subtitle text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (client_id, code),
  unique (id, client_id),
  -- an estate's region must belong to the same client
  foreign key (region_id, client_id) references public.regions (id, client_id) on delete restrict
);
create index on public.estates (region_id);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (client_id, name),
  unique (id, client_id)
);

-- ---------------------------------------------------------------- people

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  name text,
  email text not null,
  role public.app_role not null default 'client',
  disabled_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- client users always belong to a client; Sunny users never do
  check ((role = 'client') = (client_id is not null))
);
create unique index profiles_email_key on public.profiles (lower(email));

-- A row with region_id and estate_id both null grants the whole client.
-- No rows means no access (deny by default).
create table public.user_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  region_id uuid,
  estate_id uuid,
  check (region_id is null or estate_id is null),
  foreign key (region_id, client_id) references public.regions (id, client_id) on delete cascade,
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade
);
create index on public.user_scopes (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role public.app_role not null,
  client_id uuid references public.clients (id) on delete cascade,
  -- [{ "region_id": uuid|null, "estate_id": uuid|null }, ...]
  scope jsonb not null default '[]'::jsonb,
  user_id uuid references auth.users (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  check ((role = 'client') = (client_id is not null))
);
create index on public.invites (lower(email));

-- updated_by points at profiles once both exist
alter table public.clients add foreign key (updated_by) references public.profiles (id) on delete set null;
alter table public.regions add foreign key (updated_by) references public.profiles (id) on delete set null;
alter table public.estates add foreign key (updated_by) references public.profiles (id) on delete set null;
alter table public.channels add foreign key (updated_by) references public.profiles (id) on delete set null;
alter table public.profiles add foreign key (updated_by) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------- media content (estate level)

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  estate_id uuid not null,
  fy smallint not null check (fy between 2000 and 2100), -- year the FY ends: 2027 = Jul 2026 – Jun 2027
  channel_id uuid not null,
  approved numeric(12, 2) not null default 0 check (approved >= 0),
  booked numeric(12, 2) not null default 0 check (booked >= 0),
  approved_at date,
  approved_by text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (estate_id, fy, channel_id),
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade,
  foreign key (channel_id, client_id) references public.channels (id, client_id) on delete restrict
);

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  estate_id uuid not null,
  fy smallint not null check (fy between 2000 and 2100),
  channel_id uuid not null,
  vendor text,
  start_date date not null,
  end_date date not null,
  status public.flight_status not null default 'proposed',
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (end_date >= start_date),
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade,
  foreign key (channel_id, client_id) references public.channels (id, client_id) on delete restrict
);
create index on public.flights (estate_id, fy);

create table public.live_placements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  estate_id uuid not null,
  channel_id uuid not null,
  vendor text,
  creative text not null,
  live_from date not null,
  live_to date,
  preview_url text,
  paused boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (live_to is null or live_to >= live_from),
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade,
  foreign key (channel_id, client_id) references public.channels (id, client_id) on delete restrict
);
create index on public.live_placements (estate_id);

create table public.material_due (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  estate_id uuid not null,
  channel_id uuid not null,
  vendor text,
  placement text not null,
  specs text,
  due_date date not null,
  supplied_by public.supplied_by not null default 'client',
  status public.material_status not null default 'due',
  supplied_at date,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade,
  foreign key (channel_id, client_id) references public.channels (id, client_id) on delete restrict
);
create index on public.material_due (estate_id, due_date);

-- ---------------------------------------------------------------- client-level content
-- region_id / estate_id narrow the row; both null = whole client.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  region_id uuid,
  estate_id uuid,
  title text not null,
  period text,
  kind public.report_kind not null default 'whatagraph',
  url text not null check (url ~* '^https?://'),
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (region_id is null or estate_id is null),
  foreign key (region_id, client_id) references public.regions (id, client_id) on delete cascade,
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade
);

create table public.key_dates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  region_id uuid,
  estate_id uuid,
  date date not null,
  title text not null,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (region_id is null or estate_id is null),
  foreign key (region_id, client_id) references public.regions (id, client_id) on delete cascade,
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  org public.contact_org not null default 'sunny',
  role_title text not null,
  name text not null,
  email text,
  phone text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Google Sheets and other links, shown as cards. The account has many sheets,
-- so rather than syncing them we let admins add each one as a card.
create table public.sheet_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  region_id uuid,
  estate_id uuid,
  title text not null,
  description text,
  url text not null check (url ~* '^https?://'),
  staff_only boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (region_id is null or estate_id is null),
  foreign key (region_id, client_id) references public.regions (id, client_id) on delete cascade,
  foreign key (estate_id, client_id) references public.estates (id, client_id) on delete cascade
);

-- ---------------------------------------------------------------- staff only

create table public.internal_docs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade, -- null = agency-wide
  section public.doc_section not null,
  region_id uuid references public.regions (id) on delete cascade,
  title text not null,
  summary text,
  body_md text not null default '',
  url text check (url is null or url ~* '^https?://'), -- optional external doc/sheet
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------- triggers

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'regions', 'estates', 'channels', 'profiles',
    'budgets', 'flights', 'live_placements', 'material_due',
    'reports', 'key_dates', 'contacts', 'sheet_links', 'internal_docs'
  ] loop
    execute format(
      'create trigger stamp_updated before insert or update on public.%I
       for each row execute function public.stamp_updated()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- derived status views
-- security_invoker so the caller's RLS applies.

create function public.client_today(p_client_id uuid) returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select c.timezone from public.clients c where c.id = p_client_id), 'Australia/Brisbane'))::date
$$;

create view public.material_due_v with (security_invoker = true) as
select
  m.*,
  case
    when m.status = 'supplied' then 'supplied'
    when m.due_date < public.client_today(m.client_id) then 'overdue'
    when m.due_date <= public.client_today(m.client_id) + 14 then 'due_soon'
    else 'due'
  end as state
from public.material_due m;

create view public.live_placements_v with (security_invoker = true) as
select
  p.*,
  case
    when p.paused then 'paused'
    when p.live_from > public.client_today(p.client_id) then 'scheduled'
    when p.live_to is not null and p.live_to < public.client_today(p.client_id) then 'ended'
    else 'live'
  end as state
from public.live_placements p;
