-- AMORÇAGE DES RÔLES : à exécuter UNE FOIS par un opérateur disposant d un compte superutilisateur,
-- sur une base VIERGE (locale, CI, préproduction, production). Les mots de passe ne figurent JAMAIS dans le dépôt.
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -v migrator_password="..." -v auth_password="..." -v runtime_password="..." -v public_password="..." \
--     -f db/bootstrap/roles.sql
--
-- Rôles (voir docs/b0-decision-note.md, DB10) :
--   app_migrator : propriétaire des objets, BYPASSRLS. Exécute les migrations. JAMAIS utilisé par l application.
--   app_auth     : bibliothèque d authentification. Accès au schéma auth uniquement.
--   app_runtime  : données métier sous RLS. AUCUN accès au schéma auth. Ni propriétaire, ni BYPASSRLS.
--   app_public   : boutique publique (Phase 5). EXECUTE sur des fonctions en liste blanche uniquement.
-- Idempotent : un rôle existant n est pas modifié (changer un mot de passe se fait explicitement, à part).

select format($f$create role app_migrator login nosuperuser nocreatedb nocreaterole bypassrls password %L$f$, :'migrator_password')
  where not exists (select 1 from pg_roles where rolname = 'app_migrator') \gexec
select format($f$create role app_auth login nosuperuser nocreatedb nocreaterole nobypassrls password %L$f$, :'auth_password')
  where not exists (select 1 from pg_roles where rolname = 'app_auth') \gexec
select format($f$create role app_runtime login nosuperuser nocreatedb nocreaterole nobypassrls password %L$f$, :'runtime_password')
  where not exists (select 1 from pg_roles where rolname = 'app_runtime') \gexec
select format($f$create role app_public login nosuperuser nocreatedb nocreaterole nobypassrls password %L$f$, :'public_password')
  where not exists (select 1 from pg_roles where rolname = 'app_public') \gexec

-- Connexion à la base courante ; création d objets réservée au migrateur.
select format('grant connect on database %I to app_migrator, app_auth, app_runtime, app_public', current_database()) \gexec
select format('grant create on database %I to app_migrator', current_database()) \gexec
grant usage, create on schema public to app_migrator;
revoke create on schema public from public;

-- La bibliothèque d authentification référence ses tables sans schéma : elles se résolvent dans auth.
alter role app_auth set search_path = auth;
alter role app_runtime set search_path = public;
alter role app_public set search_path = public;
