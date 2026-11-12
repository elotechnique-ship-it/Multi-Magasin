-- Phase 1B / 200 : tables de la plateforme (référentiels, plans, administrateurs)
-- Impact données existantes : aucun (création uniquement).

create table public.store_categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z_]{1,39}$'),
  name       text not null,
  icon       text,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  code        text primary key check (code ~ '^[a-z][a-z_]{1,39}$'),
  name        text not null,
  description text,
  is_core     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.category_modules (
  category_id     uuid not null references public.store_categories (id),
  module_code     text not null references public.modules (code),
  default_enabled boolean not null default true,
  primary key (category_id, module_code)
);

create table public.category_fields (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.store_categories (id),
  entity      text not null check (entity in ('product', 'variant', 'customer')),
  key         text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label       text not null,
  field_type  text not null check (field_type in ('text', 'number', 'select', 'boolean', 'date')),
  options     jsonb,
  is_required boolean not null default false,
  show_in_shop boolean not null default false,
  sort_order  int not null default 0,
  unique (category_id, entity, key)
);

create table public.subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name           text not null,
  price_minor    bigint not null default 0 check (price_minor >= 0),
  currency       char(3) not null default 'XOF',
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  trial_days     int not null default 14 check (trial_days >= 0),
  grace_days     int not null default 7 check (grace_days >= 0),
  is_active      boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.plan_features (
  plan_id     uuid not null references public.subscription_plans (id),
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  int_value   int,
  bool_value  boolean,
  primary key (plan_id, feature_key)
);

create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- Administrateurs de la plateforme : table séparée, JAMAIS un drapeau dans profiles.
-- Aucune policy d'écriture pour les clients : création par procédure d'administration (scripts/admin).
create table public.platform_admins (
  user_id     uuid primary key references auth."user" (id),
  level       text not null check (level in ('owner', 'support', 'finance')),
  created_by  uuid references auth."user" (id),
  created_at  timestamptz not null default now(),
  disabled_at timestamptz
);

create trigger store_categories_updated_at before update on public.store_categories
  for each row execute function private.set_updated_at();
create trigger subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function private.set_updated_at();
