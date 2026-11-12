-- pgTAP : socle de sécurité (option B). Exécution : npm run db:test (base de TEST uniquement).
begin;
select * from no_plan();

-- ═════════ 1. RLS ═════════
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'auth') and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0, 'toutes les tables de public et auth ont la RLS activée');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'auth') and c.relkind in ('r', 'p') and not c.relforcerowsecurity),
  0, 'toutes les tables de public et auth ont la RLS forcée');

-- ═════════ 2. Attributs des rôles ═════════
select is(
  (select count(*)::int from pg_roles
   where rolname in ('app_auth', 'app_runtime', 'app_public')
     and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)),
  0, 'les rôles applicatifs n''ont aucun attribut privilégié');
select ok((select rolbypassrls and not rolsuper from pg_roles where rolname = 'app_migrator'),
  'app_migrator : BYPASSRLS, non superutilisateur');
select is(
  (select count(*)::int from pg_class c join pg_roles r on r.oid = c.relowner
   where r.rolname in ('app_auth', 'app_runtime', 'app_public') and c.relnamespace::regnamespace::text in ('public', 'auth', 'private')),
  0, 'aucun rôle applicatif n''est propriétaire d''un objet');
select is(
  (select count(*)::int from pg_class c join pg_roles r on r.oid = c.relowner
   where r.rolname <> 'app_migrator' and c.relkind in ('r', 'p', 'v') and c.relnamespace::regnamespace::text in ('public', 'auth')),
  0, 'toutes les tables de public et auth appartiennent à app_migrator');

-- ═════════ 3. Isolation du schéma auth ═════════
select is(has_schema_privilege('app_runtime', 'auth', 'usage'), false, 'app_runtime : aucun accès au schéma auth');
select is(has_schema_privilege('app_public', 'auth', 'usage'), false, 'app_public : aucun accès au schéma auth');
select is(has_schema_privilege('app_auth', 'auth', 'usage'), true, 'app_auth : accès au schéma auth');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee in ('app_runtime', 'app_public') and table_schema = 'auth'),
  0, 'aucun privilège de table sur auth pour app_runtime et app_public');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'app_auth' and table_schema = 'public'),
  0, 'app_auth : aucun privilège sur les tables métier');
select is(has_schema_privilege('app_auth', 'private', 'usage'), false, 'app_auth : aucun accès au schéma private');

-- ═════════ 4. app_public : aucun accès direct ═════════
select is(
  (select count(*)::int from information_schema.role_table_grants where grantee = 'app_public' and table_schema = 'public'),
  0, 'app_public : aucun privilège de table sur public');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('app_public', p.oid, 'execute')),
  0, 'app_public : aucune fonction exécutable dans public (liste blanche vide en Phase 1)');

-- ═════════ 5. Fonctions SECURITY DEFINER ═════════
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private', 'auth') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')),
  0, 'toutes les fonctions SECURITY DEFINER fixent search_path');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and has_function_privilege('public', p.oid, 'execute')),
  0, 'aucune fonction de public/private n''est exécutable par PUBLIC');

-- ═════════ 6. app_runtime : aucune écriture directe sur les tables sensibles ═════════
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'app_runtime' and table_schema = 'public'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     and table_name in ('platform_admins', 'store_members', 'member_roles', 'audit_logs',
                        'login_events', 'security_events', 'store_invitations', 'roles', 'role_permissions')),
  0, 'app_runtime : aucune écriture directe sur les tables sensibles');
select is(has_column_privilege('app_runtime', 'public.store_invitations', 'token_hash', 'select'),
  false, 'token_hash non lisible par app_runtime');

-- ═════════ 7. Référentiel ═════════
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
