-- Phase 1B / 300 : magasins (tenants), points de vente, invitations
-- Impact données existantes : aucun (création uniquement).

create type public.store_status as enum ('pending_activation', 'active', 'suspended', 'archived');
create type public.store_access as enum ('full', 'read_only', 'blocked');

create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
              check (slug not in ('admin','api','auth','boutique','magasin','superadmin','q','www','app','static','_next')),
  -- Code court IMMUABLE encodé dans le QR Code (/q/{public_code}) ; indépendant du slug.
  public_code text not null unique default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10),
  name        text not null check (length(btrim(name)) between 2 and 120),
  category_id uuid not null references public.store_categories (id),
  status      public.store_status not null default 'pending_activation',
  -- Niveau d'accès dérivé de l'abonnement : écrit uniquement par des fonctions privilégiées.
  access      public.store_access not null default 'full',
  currency    char(3) not null default 'XOF',
  timezone    text not null default 'Africa/Dakar',
  theme       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table public.store_slug_history (
  slug       text primary key,
  store_id   uuid not null references public.stores (id),
  changed_at timestamptz not null default now()
);

create table public.store_settings (
  store_id   uuid primary key references public.stores (id),
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.store_modules (
  store_id    uuid not null references public.stores (id),
  module_code text not null references public.modules (code),
  is_enabled  boolean not null default true,
  primary key (store_id, module_code)
);

create table public.store_locations (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id),
  name       text not null check (length(btrim(name)) between 1 and 120),
  kind       text not null default 'shop' check (kind in ('shop', 'warehouse')),
  is_default boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id)
);
create unique index store_locations_one_default on public.store_locations (store_id) where is_default;

create trigger stores_updated_at before update on public.stores
  for each row execute function private.set_updated_at();
create trigger store_locations_updated_at before update on public.store_locations
  for each row execute function private.set_updated_at();
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function private.set_updated_at();

create trigger store_locations_store_immutable before update on public.store_locations
  for each row execute function private.forbid_store_id_change();
create trigger store_settings_store_immutable before update on public.store_settings
  for each row execute function private.forbid_store_id_change();
create trigger store_modules_store_immutable before update on public.store_modules
  for each row execute function private.forbid_store_id_change();

-- Le code public du QR ne change jamais, même via une fonction privilégiée.
create or replace function private.forbid_public_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.public_code is distinct from old.public_code then
    raise exception 'public_code is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger stores_public_code_immutable before update on public.stores
  for each row execute function private.forbid_public_code_change();
