-- PROCÉDURE D'ADMINISTRATION (hors application) : promouvoir un compte existant en administrateur de plateforme.
-- À exécuter manuellement, par un opérateur autorisé, via psql ou le SQL Editor Supabase.
-- 1) Le compte doit déjà exister dans auth.users (créé par invitation).
-- 2) Remplacer l'e-mail ci-dessous. Aucun secret n'est stocké dans ce fichier.
-- 3) L'administrateur devra enrôler la MFA (TOTP) à sa première connexion : sans AAL2, aucun droit plateforme.
--
--   \set admin_email 'prenom.nom@exemple.com'
--   \set admin_level 'owner'     -- owner | support | finance

insert into public.platform_admins (user_id, level)
select u.id, :'admin_level'
from auth.users u
where lower(u.email) = lower(:'admin_email')
on conflict (user_id) do nothing;

-- Trace de l'opération :
insert into public.audit_logs (store_id, actor_id, action, entity_type, detail)
select null, null, 'platform_admin.granted', 'platform_admin',
       jsonb_build_object('email', :'admin_email', 'level', :'admin_level');
