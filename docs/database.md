# Base de données PostgreSQL

> **Partiellement caduc (option B).** Ce document décrit le modèle Supabase (`auth.uid()`, `auth.users`, rôles `anon`/`authenticated`, JWT). Pour l'option B voir `b0-decision-note.md` et `option-b-plan.md` ; il sera réécrit au lot B6. Les principes (isolation par magasin, refus par défaut, journaux en ajout seul) restent inchangés.


Le SQL ci-dessous est un **schéma de conception**. Les migrations exécutables seront livrées par phase, versionnées et testées. Aucune n'a été exécutée à ce jour.

## 1. Conventions

- Identifiants `uuid` (`gen_random_uuid()`), `created_at` / `updated_at` (trigger), suppression logique (`deleted_at`) sur les entités éditables.
- **Argent : `bigint` en unités mineures** (XOF = 0 décimale). Quantités : `numeric(14,3)`.
- `store_id NOT NULL` sur toute table métier, **immuable** (trigger), en tête de tous les index composites.
- **Clés étrangères composites** `(store_id, id)` : une ligne d'un magasin ne peut pas référencer une ligne d'un autre.
- Schémas : `public` (tables et RPC exposées), `private` (fonctions d'aide RLS, non exposées par l'API).
- Journaux en ajout seul (`stock_movements`, `audit_logs`, `login_events`, `security_events`) : `UPDATE`/`DELETE` bloqués par trigger et privilèges.
- Tout produit possède au moins une **variante par défaut** : stock, ventes et lots référencent toujours une `variant_id`.
- Prérequis : PostgreSQL 15+ (`UNIQUE NULLS NOT DISTINCT`), extensions `citext`, `pg_trgm`.
- Ordre de création : les tables référencées sont créées avant celles qui les référencent (`product_categories` avant `products`, etc.).

## 2. Catalogue des tables

➕ = ajout par rapport à la liste du cahier.

| Domaine | Tables |
|---|---|
| Plateforme | `platform_admins`, `store_categories`, `modules`, `category_modules`, ➕`category_fields`, `subscription_plans`, `plan_features`, `platform_settings` |
| Magasins | `stores`, ➕`store_slug_history`, `store_settings`, ➕`store_modules`, `store_locations`, ➕`registers`, ➕`store_invitations` |
| Identité et droits | `profiles`, `roles`, `permissions`, `role_permissions`, `store_members`, `member_roles` |
| Produits | `products`, `product_categories`, `product_variants`, `product_images`, `product_units`, `product_batches`, ➕`serial_numbers` |
| Stock | `stock_levels` (soldes, équivalent de `inventories`), `stock_movements` (grand livre), `inventory_adjustments`, ➕`inventory_counts`, `stock_transfers` (+ lignes) |
| Ventes | `sales`, `sale_items`, `sale_payments`, `sale_returns`, `sale_return_items`, `cash_sessions`, ➕`document_counters` |
| Clients et commandes | `customers`, `customer_addresses`, `customer_orders`, `order_items`, ➕`order_status_history`, `customer_payments`, ➕`customer_ledger` |
| Fournisseurs | `suppliers`, `purchase_orders`, `purchase_order_items`, `supplier_payments` |
| Finances | `expenses`, `expense_categories`, `financial_transactions` |
| Marketing | `banners`, `promotions`, ➕`promotion_products`, `loyalty_programs`, `loyalty_transactions` |
| Modules métier | ➕`quotes`, ➕`quote_items`, ➕`warranties`, ➕`service_tickets`, ➕`recipes`, ➕`recipe_items`, ➕`production_orders`, ➕`service_catalog`, ➕`service_transactions` |
| Abonnements | `subscriptions`, `subscription_invoices`, `subscription_payments`, `payment_transactions`, ➕`webhook_events` |
| Support, notifications | ➕`support_tickets`, ➕`ticket_messages`, ➕`notifications`, ➕`store_storage_usage` |
| Sécurité, conformité | `audit_logs`, `login_events`, `security_events`, ➕`data_requests` |

## 3. DDL des structures critiques

```sql
create schema if not exists private;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ───────── Plateforme ─────────
create table platform_admins (
  user_id     uuid primary key references auth.users(id),
  level       text not null check (level in ('owner','support','finance')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  disabled_at timestamptz
);
-- Aucune policy INSERT/UPDATE pour les clients : promotion par procédure d'administration uniquement.

create table store_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, name text not null, icon text,
  is_active boolean not null default true, sort_order int not null default 0,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table category_fields (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references store_categories(id),
  entity text not null check (entity in ('product','variant','customer')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null,
  field_type text not null check (field_type in ('text','number','select','boolean','date')),
  options jsonb, is_required boolean not null default false,
  show_in_shop boolean not null default false, sort_order int not null default 0,
  unique (category_id, entity, key)
);

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, name text not null,
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null default 'XOF',
  billing_period text not null check (billing_period in ('monthly','yearly')),
  trial_days int not null default 14, grace_days int not null default 7,
  is_active boolean not null default true, sort_order int not null default 0
);
create table plan_features (
  plan_id uuid references subscription_plans(id) on delete cascade,
  feature_key text not null,   -- max_products, max_users, max_locations, max_registers, storage_mb,
  int_value int,               -- shop_enabled, orders_enabled, promotions_enabled, reports_enabled, ...
  bool_value boolean,
  primary key (plan_id, feature_key)
);

-- ───────── Magasins ─────────
create type store_status as enum ('pending_activation','active','suspended','archived');
create type store_access as enum ('full','read_only','blocked');   -- écrit uniquement par fonctions privées

create table stores (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  public_code text unique not null,   -- code court IMMUABLE encodé dans le QR Code
  name text not null,
  category_id uuid not null references store_categories(id),
  status store_status not null default 'pending_activation',
  access store_access not null default 'full',
  currency char(3) not null default 'XOF',
  timezone text not null default 'Africa/Dakar',
  theme jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table store_slug_history (
  slug citext primary key, store_id uuid not null references stores(id),
  changed_at timestamptz not null default now()
);

create table store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  name text not null,
  kind text not null default 'shop' check (kind in ('shop','warehouse')),
  is_default boolean not null default false, is_active boolean not null default true,
  unique (store_id, id)
);
create unique index one_default_location on store_locations(store_id) where is_default;

-- ───────── Membres, rôles, permissions ─────────
create table roles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id),    -- NULL = rôle système
  code text not null, name text not null, is_system boolean not null default false,
  unique nulls not distinct (store_id, code)
);
create table permissions (code text primary key, module_code text, description text);
create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_code text references permissions(code),
  primary key (role_id, permission_code)
);
create table store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  user_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id), unique (store_id, id)
);
create table member_roles (
  member_id uuid references store_members(id) on delete cascade,
  role_id uuid references roles(id),
  location_id uuid,   -- NULL = tous les sites (restriction par site : Phase 8)
  primary key (member_id, role_id)
);

-- ───────── Produits ─────────
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id), parent_id uuid, name text not null,
  sort_order int not null default 0, deleted_at timestamptz,
  unique (store_id, id)
);
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  category_id uuid, name text not null,
  kind text not null default 'good' check (kind in ('good','service')),
  sale_mode text not null default 'unit' check (sale_mode in ('unit','weight')),
  price_minor bigint not null check (price_minor >= 0),
  cost_minor bigint check (cost_minor >= 0),
  promo_price_minor bigint check (promo_price_minor >= 0),
  tax_rate numeric(5,2) not null default 0,
  track_stock boolean not null default true,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  shop_visible boolean not null default false,
  shop_stock_display text not null default 'status' check (shop_stock_display in ('hidden','status','exact')),
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, category_id) references product_categories (store_id, id),
  check (promo_price_minor is null or promo_price_minor < price_minor)
);
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null, product_id uuid not null,
  sku text, barcode text, option_values jsonb not null default '{}',
  price_override_minor bigint check (price_override_minor >= 0),
  is_default boolean not null default false,
  unique (store_id, id),
  foreign key (store_id, product_id) references products (store_id, id)
);
create unique index variants_barcode_uq on product_variants(store_id, barcode) where barcode is not null;
create unique index variants_one_default on product_variants(store_id, product_id) where is_default;

-- ───────── Stock ─────────
create table stock_levels (   -- soldes ; modifiés UNIQUEMENT par apply_stock_movement()
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null, location_id uuid not null, variant_id uuid not null, batch_id uuid,
  quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (store_id, location_id, variant_id, batch_id),
  foreign key (store_id, location_id) references store_locations (store_id, id),
  foreign key (store_id, variant_id)  references product_variants (store_id, id)
);
create table stock_movements (  -- grand livre append-only
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null, location_id uuid not null, variant_id uuid not null, batch_id uuid,
  movement_type text not null check (movement_type in
    ('initial','purchase_receipt','sale','sale_return','adjustment','inventory_count',
     'transfer_out','transfer_in','loss','damage','production_in','production_out')),
  quantity numeric(14,3) not null check (quantity <> 0),   -- signé
  unit_cost_minor bigint, ref_type text, ref_id uuid, reason text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  foreign key (store_id, location_id) references store_locations (store_id, id),
  foreign key (store_id, variant_id)  references product_variants (store_id, id)
);
create index on stock_movements (store_id, variant_id, created_at desc);

-- ───────── Ventes (extrait) ─────────
create table sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null, location_id uuid not null, cash_session_id uuid,
  number text not null,                 -- séquentiel par store via document_counters
  client_uuid uuid not null,            -- idempotence
  customer_id uuid,
  status text not null default 'completed' check (status in ('completed','canceled','partially_returned')),
  subtotal_minor bigint not null, discount_minor bigint not null default 0,
  tax_minor bigint not null default 0, total_minor bigint not null, paid_minor bigint not null default 0,
  created_by uuid not null, created_at timestamptz not null default now(),
  unique (store_id, id), unique (store_id, number), unique (store_id, client_uuid)
);
-- sale_items : snapshot nom/prix/coût/taxe de la ligne ; FK composites (store_id, sale_id), (store_id, variant_id)
-- sale_payments : method in ('cash','wave','orange_money','card','credit','other'), reference

-- ───────── Commandes en ligne (extrait) ─────────
-- customer_orders : public_token (128 bits, unique), number, fulfilment in ('pickup','delivery'),
--   status in ('pending','confirmed','preparing','ready','out_for_delivery','delivered','canceled'),
--   customer_name, phone, address jsonb ; order_status_history en ajout seul.

-- ───────── Abonnements et paiements ─────────
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id), plan_id uuid not null references subscription_plans(id),
  status text not null check (status in ('trial','active','pending','overdue','suspended','canceled','expired')),
  price_minor bigint not null, currency char(3) not null,
  period_start date, period_end date, next_due_at timestamptz, grace_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_live_subscription on subscriptions(store_id)
  where status in ('trial','active','pending','overdue','suspended');

create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null, provider text not null check (provider in ('wave','orange_money','manual','other')),
  provider_ref text, amount_minor bigint not null, currency char(3) not null,
  status text not null check (status in ('initiated','pending','succeeded','failed','refunded')),
  validated_by uuid references auth.users(id),    -- paiement manuel
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create table webhook_events (
  provider text not null, event_id text not null, payload jsonb not null,
  signature_valid boolean not null, processed_at timestamptz,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
```

## 4. Règles de cohérence

- **Stock** : aucun `UPDATE` direct sur `stock_levels`. Toute variation passe par `apply_stock_movement()`, qui écrit le mouvement et met à jour le solde dans la même transaction. Un solde négatif est refusé sauf paramètre explicite du store.
- **Numérotation** : `document_counters (store_id, doc_type, year, last_value)` incrémenté sous verrou ; numéros sans trou dans une série.
- **Finances** : chiffre d'affaires, encaissements, marge estimée et bénéfice net sont des agrégats distincts, jamais confondus.
- **Limites de plan** : triggers `BEFORE INSERT` appelant `private.check_limit(store_id, feature_key)`.

## 5. Stratégie de migrations

- Nom : `YYYYMMDDHHMMSS_phaseN_description.sql`, une responsabilité par fichier.
- Chaque migration comporte : objectif, tables touchées, impact sur données existantes, note de retour arrière.
- **Additives uniquement** : création de tables/colonnes/index, colonnes nullables puis remplissage puis contraintes. Aucun `DROP`, `TRUNCATE`, `DELETE` massif ni renommage sans validation écrite (la CI bloque ces instructions sans marqueur d'approbation).
- Application : local → préproduction → production **après autorisation**.
- Données de test : fictives uniquement, dans `supabase/seed`, jamais appliquées en production.

## 6. Compatibilité avec un projet existant (Gate A)

Avant toute intégration : inventaire des tables, politiques RLS, fonctions, triggers, migrations appliquées, buckets Storage et comptes. Les objets existants sont **cartographiés puis préservés** ; les écarts avec ce schéma sont traités par migrations additives (vue de compatibilité, colonnes nullables, backfill, puis contraintes). Tant que l'audit n'est pas fait, le développement reste sur un projet vierge.

## 7. Performance (20 magasins visés)

- Index composites commençant par `store_id` ; recherche produit par `pg_trgm` et `tsvector`.
- Fonctions de droits : `auth.uid()` / `auth.jwt()` enveloppés dans `(select ...)` à l'intérieur des fonctions d'aide ; les appels par ligne passent par des recherches indexées sur `store_members`.
- Partitionnement de `stock_movements`, `audit_logs`, `sales` différé ; à réévaluer au-delà de quelques centaines de magasins.
