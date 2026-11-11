-- Phase 1.2 / 400 : profils, rôles, permissions, membres, invitations
-- Impact données existantes : un profil est créé pour chaque compte Auth existant (backfill, sans suppression).

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_path text,
  locale      text not null default 'fr',
  is_disabled boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.permissions (
  code        text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  module_code text,
  description text
);

create table public.roles (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid references public.stores (id),  -- NULL = rôle système
  code       text not null check (code ~ '^[a-z][a-z_]{1,39}$'),
  name       text not null,
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  unique nulls not distinct (store_id, code)
);

create table public.role_permissions (
  role_id         uuid not null references public.roles (id),
  permission_code text not null references public.permissions (code),
  primary key (role_id, permission_code)
);

create table public.store_members (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id),
  user_id    uuid not null references auth.users (id),
  status     text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id),
  unique (store_id, id)
);
create index store_members_user_idx on public.store_members (user_id);
create trigger store_members_store_immutable before update on public.store_members
  for each row execute function private.forbid_store_id_change();

create table public.member_roles (
  member_id   uuid not null references public.store_members (id),
  role_id     uuid not null references public.roles (id),
  location_id uuid,  -- NULL = tous les sites (restriction par site : Phase 8)
  primary key (member_id, role_id)
);

create table public.store_invitations (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id),
  email       text not null check (email = lower(email)),
  role_id     uuid not null references public.roles (id),
  token_hash  bytea not null unique,   -- SHA-256 du jeton ; le jeton en clair n'est jamais stocké
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  revoked_at  timestamptz,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);
create index store_invitations_store_idx on public.store_invitations (store_id);

-- Création automatique du profil à l'inscription d'un compte Auth.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill (sans effet sur une base vierge ; sans suppression sur une base existante).
insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;
