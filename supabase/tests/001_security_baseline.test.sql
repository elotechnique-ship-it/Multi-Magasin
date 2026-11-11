-- pgTAP : socle de sécurité. Exécution : `supabase test db` (base locale éphémère uniquement).
begin;
select * from no_plan();

-- 1. RLS activée ET forcée sur toutes les tables du schéma public
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0, 'toutes les tables public ont la RLS activée');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relforcerowsecurity),
  0, 'toutes les tables public ont la RLS forcée');

-- 2. anon n'a aucun privilège de table, ni d'exécution de fonction dans public
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  0, 'anon : aucun privilège de table sur public');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon : aucune fonction exécutable dans public');

-- 3. Toute fonction SECURITY DEFINER fixe son search_path
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')),
  0, 'toutes les fonctions SECURITY DEFINER fixent search_path');

-- 4. authenticated n'a aucun droit d'écriture direct sur les tables sensibles
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'authenticated' and table_schema = 'public'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     and table_name in ('platform_admins', 'store_members', 'member_roles', 'audit_logs',
                        'login_events', 'security_events', 'store_invitations', 'roles', 'role_permissions')),
  0, 'authenticated : aucune écriture directe sur les tables sensibles');

-- 5. Le hachage du jeton d'invitation n'est lisible par aucun client
select is(
  has_column_privilege('authenticated', 'public.store_invitations', 'token_hash', 'select'),
  false, 'token_hash non lisible par authenticated');

-- 6. Référentiel de base présent
select is((select count(*)::int from public.store_categories), 12, '12 catégories en base');
select is((select count(*)::int from public.roles where store_id is null), 8, '8 rôles système');
select ok(
  not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
              where r.code = 'cashier' and rp.permission_code in ('users.manage', 'products.view_cost', 'sales.view_profit')),
  'le caissier n''a ni gestion d''équipe, ni prix d''achat, ni marges');
select ok(
  not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
              where r.code = 'store_admin' and rp.permission_code = 'billing.manage'),
  'store_admin n''a pas billing.manage');

select * from finish();
rollback;
