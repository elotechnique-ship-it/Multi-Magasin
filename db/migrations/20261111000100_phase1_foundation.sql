-- Phase 1B / 100 : fondations (option B, PostgreSQL seul)
-- Exécuté par app_migrator (voir db/bootstrap/roles.sql). Impact données existantes : aucun (création uniquement).

do $$
declare r text;
begin
  foreach r in array array['app_migrator', 'app_auth', 'app_runtime', 'app_public'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      raise exception 'rôle % manquant : exécutez db/bootstrap/roles.sql avant les migrations', r;
    end if;
  end loop;
  if (select rolsuper or not rolbypassrls from pg_roles where rolname = 'app_migrator') then
    raise exception 'app_migrator doit être BYPASSRLS et non superutilisateur';
  end if;
  if exists (select 1 from pg_roles where rolname in ('app_auth', 'app_runtime', 'app_public') and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)) then
    raise exception 'app_auth, app_runtime et app_public ne doivent avoir ni SUPERUSER, ni BYPASSRLS, ni CREATEROLE, ni CREATEDB';
  end if;
end
$$;

create schema if not exists private;
create schema if not exists auth;

-- schéma private : jamais exposé directement ; usage pour exécuter les fonctions d'aide appelées par les politiques RLS.
revoke all on schema private from public;
grant usage on schema private to app_runtime;

-- schéma auth : réservé à la bibliothèque d'authentification. AUCUN accès pour app_runtime ni app_public.
revoke all on schema auth from public;
grant usage on schema auth to app_auth;

-- Deny-by-default pour les objets FUTURS créés par le migrateur : chaque migration accorde explicitement ses droits.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from app_runtime, app_public, app_auth;
alter default privileges in schema public revoke all on sequences from app_runtime, app_public, app_auth;
alter default privileges in schema public revoke all on functions from app_runtime, app_public, app_auth;
alter default privileges in schema private revoke all on functions from app_runtime, app_public, app_auth;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function private.forbid_store_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception 'store_id is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function private.forbid_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'table % is append-only', tg_table_name using errcode = '42501';
end
$$;
