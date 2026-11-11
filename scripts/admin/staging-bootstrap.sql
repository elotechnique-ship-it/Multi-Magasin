-- PRÉPRODUCTION UNIQUEMENT. Données fictives. JAMAIS en production ni sur le projet existant.
-- Crée un magasin de démonstration actif dont le propriétaire est un compte DÉJÀ existant dans auth.users.
-- (La création de magasin par le SuperAdmin arrive en Phase 2 ; ce script la remplace en attendant.)
--
-- Usage (depuis votre poste, avec l'URL de connexion du projet de PRÉPRODUCTION) :
--   psql "$STAGING_DB_URL" -v owner_email='proprietaire@exemple.com' \
--        -v store_slug='demo-boutique' -v store_name='Boutique de démonstration' \
--        -f scripts/admin/staging-bootstrap.sql
--
-- Si le compte n'existe pas, le script échoue et RIEN n'est créé (transaction unique, ON_ERROR_STOP).

\set ON_ERROR_STOP on
begin;

with cat as (
  select id from public.store_categories where code = 'autres'
), s as (
  insert into public.stores (slug, name, category_id, status)
  select :'store_slug', :'store_name', cat.id, 'active' from cat
  returning id
), loc as (
  insert into public.store_locations (store_id, name, is_default)
  select id, 'Point de vente principal', true from s
  returning store_id
), st as (
  insert into public.store_settings (store_id) select id from s returning store_id
), mods as (
  insert into public.store_modules (store_id, module_code)
  select s.id, cm.module_code
  from s
  cross join public.store_categories c
  join public.category_modules cm on cm.category_id = c.id
  where c.code = 'autres'
  returning store_id
), mem as (
  -- user_id NULL si l'e-mail est inconnu => violation NOT NULL => annulation de toute la transaction
  insert into public.store_members (store_id, user_id, status)
  values ((select id from s), (select id from auth.users where lower(email) = lower(:'owner_email')), 'active')
  returning id
)
insert into public.member_roles (member_id, role_id)
select mem.id, r.id from mem join public.roles r on r.store_id is null and r.code = 'owner';

insert into public.audit_logs (store_id, action, entity_type, detail)
select id, 'staging.bootstrap', 'store', jsonb_build_object('note', 'magasin de démonstration créé par script')
from public.stores where slug = :'store_slug';

commit;
