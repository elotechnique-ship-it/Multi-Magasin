-- Phase 1.2 / 100 : fondations
-- Objectif : schéma privé, privilèges "deny by default", fonctions utilitaires.
-- Impact données existantes : aucun (création uniquement). Retour arrière : supprimer le schéma private.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Deny-by-default pour les objets FUTURS créés par le rôle de migration.
-- Chaque migration doit accorder explicitement ses droits (GRANT) : rien n'est ouvert implicitement.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Trigger : horodatage de mise à jour.
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

-- Trigger : store_id immuable (une ligne ne peut jamais changer de magasin).
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

-- Trigger : table en ajout seul (journaux).
create or replace function private.forbid_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'table % is append-only', tg_table_name using errcode = '42501';
end
$$;
