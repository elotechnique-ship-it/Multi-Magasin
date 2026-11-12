-- Phase 1B / 150 : schéma d'authentification (tables par défaut de Better Auth, identifiants UUID)
-- !! Écrit d'après la documentation : à COMPARER avec la sortie de la commande de génération de schéma
-- !! de Better Auth à la première installation (critère de sortie du lot B1, voir docs/b0-decision-note.md §2.3).
-- Accès : app_auth uniquement. app_runtime et app_public n'ont AUCUN droit sur ce schéma.

create table auth."user" (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  email              text not null unique,
  "emailVerified"    boolean not null default false,
  image              text,
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now(),
  "twoFactorEnabled" boolean not null default false
);
create unique index auth_user_email_lower_idx on auth."user" (lower(email));

create table auth.session (
  id          uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token       text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    uuid not null references auth."user" (id) on delete cascade
);
create index auth_session_user_idx on auth.session ("userId");

create table auth.account (
  id                      uuid primary key default gen_random_uuid(),
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                uuid not null references auth."user" (id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,   -- hachage du mot de passe (jamais le mot de passe)
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now(),
  unique ("providerId", "accountId")
);
create index auth_account_user_idx on auth.account ("userId");

create table auth.verification (
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,
  value       text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index auth_verification_identifier_idx on auth.verification (identifier);

create table auth."twoFactor" (
  id            uuid primary key default gen_random_uuid(),
  secret        text not null,
  "backupCodes" text not null,
  "userId"      uuid not null references auth."user" (id) on delete cascade
);
create index auth_twofactor_user_idx on auth."twoFactor" ("userId");

create table auth."rateLimit" (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  count         int not null,
  "lastRequest" bigint not null
);

-- RLS activée et forcée ; une seule politique par table, réservée à app_auth.
alter table auth."user" enable row level security;
alter table auth."user" force row level security;
alter table auth.session enable row level security;
alter table auth.session force row level security;
alter table auth.account enable row level security;
alter table auth.account force row level security;
alter table auth.verification enable row level security;
alter table auth.verification force row level security;
alter table auth."twoFactor" enable row level security;
alter table auth."twoFactor" force row level security;
alter table auth."rateLimit" enable row level security;
alter table auth."rateLimit" force row level security;

grant select, insert, update, delete on auth."user", auth.session, auth.account, auth.verification, auth."twoFactor", auth."rateLimit" to app_auth;

create policy auth_user_app_auth on auth."user" for all to app_auth using (true) with check (true);
create policy auth_session_app_auth on auth.session for all to app_auth using (true) with check (true);
create policy auth_account_app_auth on auth.account for all to app_auth using (true) with check (true);
create policy auth_verification_app_auth on auth.verification for all to app_auth using (true) with check (true);
create policy auth_twofactor_app_auth on auth."twoFactor" for all to app_auth using (true) with check (true);
create policy auth_ratelimit_app_auth on auth."rateLimit" for all to app_auth using (true) with check (true);
