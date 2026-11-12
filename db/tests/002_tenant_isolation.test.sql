-- pgTAP (option B) : isolation inter-magasins, permissions, 2FA SuperAdmin, sessions vérifiées par la base, invitations, journaux.
-- Données 100 % fictives, dans une transaction annulée (rollback) : rien n'est conservé.
-- Exécution : npm run db:test (base de TEST uniquement). Rôles applicatifs : app_runtime, app_public.
begin;
select * from no_plan();

-- ═════════════ Données de test (en tant que propriétaire de la base) ═════════════
-- Utilisateurs (table auth."user") et sessions : le jeton identifie l'utilisateur, la base le retrouve
insert into auth."user" (id, name, email, "twoFactorEnabled") values
  ('a0000000-0000-0000-0000-0000000000a1', 'Owner A', 'owner.a@test.local', false),
  ('a0000000-0000-0000-0000-0000000000a2', 'Cashier A', 'cashier.a@test.local', false),
  ('b0000000-0000-0000-0000-0000000000b1', 'Owner B', 'owner.b@test.local', false),
  ('c0000000-0000-0000-0000-0000000000c1', 'Outsider', 'outsider@test.local', false),
  ('d0000000-0000-0000-0000-0000000000d1', 'Admin', 'admin@test.local', false),
  ('e0000000-0000-0000-0000-0000000000e1', 'Invitee', 'invitee@test.local', false),
  ('e0000000-0000-0000-0000-0000000000e2', 'Wrong', 'wrong@test.local', false),
  ('f0000000-0000-0000-0000-0000000000f1', 'Suspended', 'suspended@test.local', false);

insert into auth.session (token, "userId", "expiresAt") values
  ('tok-owner-a',     'a0000000-0000-0000-0000-0000000000a1', now() + interval '1 hour'),
  ('tok-cashier-a',   'a0000000-0000-0000-0000-0000000000a2', now() + interval '1 hour'),
  ('tok-owner-b',     'b0000000-0000-0000-0000-0000000000b1', now() + interval '1 hour'),
  ('tok-outsider',    'c0000000-0000-0000-0000-0000000000c1', now() + interval '1 hour'),
  ('tok-admin',       'd0000000-0000-0000-0000-0000000000d1', now() + interval '1 hour'),
  ('tok-invitee',     'e0000000-0000-0000-0000-0000000000e1', now() + interval '1 hour'),
  ('tok-wrong',       'e0000000-0000-0000-0000-0000000000e2', now() + interval '1 hour'),
  ('tok-suspended',   'f0000000-0000-0000-0000-0000000000f1', now() + interval '1 hour'),
  ('tok-expired-a',   'a0000000-0000-0000-0000-0000000000a1', now() - interval '1 hour');

-- Magasins A et B
insert into public.stores (id, slug, name, category_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'store-a', 'Boutique A', (select id from public.store_categories where code = 'autres'), 'active'),
  ('22222222-2222-2222-2222-222222222222', 'store-b', 'Boutique B', (select id from public.store_categories where code = 'autres'), 'active');

insert into public.store_locations (id, store_id, name, is_default) values
  ('1111aaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Site A', true),
  ('2222bbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Site B', true);

-- Membres et rôles
insert into public.store_members (id, store_id, user_id, status) values
  ('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-0000000000a1', 'active'),
  ('aaaa0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-0000000000a2', 'active'),
  ('bbbb0000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-0000000000b1', 'active'),
  ('aaaa0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-0000000000f1', 'suspended');

insert into public.member_roles (member_id, role_id) values
  ('aaaa0000-0000-0000-0000-000000000001', (select id from public.roles where store_id is null and code = 'owner')),
  ('aaaa0000-0000-0000-0000-000000000002', (select id from public.roles where store_id is null and code = 'cashier')),
  ('bbbb0000-0000-0000-0000-000000000001', (select id from public.roles where store_id is null and code = 'owner'));

-- Administrateur plateforme
insert into public.platform_admins (user_id, level) values ('d0000000-0000-0000-0000-0000000000d1', 'owner');

-- Invitations (jetons de test ; seul leur hachage est stocké)
insert into public.store_invitations (id, store_id, email, role_id, token_hash, expires_at) values
  ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'invitee@test.local',
   (select id from public.roles where store_id is null and code = 'manager'),
   sha256(convert_to('tok-valid-aaaaaaaaaaaa', 'utf8')), now() + interval '1 day'),
  ('90000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'invitee@test.local',
   (select id from public.roles where store_id is null and code = 'manager'),
   sha256(convert_to('tok-expired-aaaaaaaaaa', 'utf8')), now() - interval '1 day'),
  ('90000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'suspended@test.local',
   (select id from public.roles where store_id is null and code = 'manager'),
   sha256(convert_to('tok-suspended-aaaaaaa', 'utf8')), now() + interval '1 day');

select private.write_audit('11111111-1111-1111-1111-111111111111', 'test.event', 'test', null, '{}'::jsonb);
select private.write_audit('22222222-2222-2222-2222-222222222222', 'test.event', 'test', null, '{}'::jsonb);

-- ═════════════ Propriétaire du magasin A ═════════════
set local role app_runtime;
select set_config('app.session_token', 'tok-owner-a', true);

select is((select count(*)::int from public.stores), 1, 'A ne voit que son magasin');
select is((select slug from public.stores), 'store-a', 'A voit bien store-a');
select is((select count(*)::int from public.store_locations where store_id = '22222222-2222-2222-2222-222222222222'), 0, 'A ne voit aucun site de B');
select is((select count(*)::int from public.store_members where store_id = '22222222-2222-2222-2222-222222222222'), 0, 'A ne voit aucun membre de B');

select results_eq(
  $$ with u as (update public.stores set name = 'Piratage' where id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'A ne peut pas modifier le magasin B');
select results_eq(
  $$ with u as (update public.stores set name = 'Boutique A renommée' where id = '11111111-1111-1111-1111-111111111111' returning 1) select count(*)::int from u $$,
  $$ values (1) $$, 'A peut renommer son magasin');
select throws_ok(
  $$ update public.stores set status = 'suspended' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'A ne peut pas modifier le statut de son magasin');
select throws_ok(
  $$ update public.stores set access = 'full' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'A ne peut pas modifier le niveau d''accès');

select lives_ok(
  $$ insert into public.store_locations (store_id, name) values ('11111111-1111-1111-1111-111111111111', 'Dépôt') $$,
  'A peut créer un site dans son magasin');
select throws_ok(
  $$ insert into public.store_locations (store_id, name) values ('22222222-2222-2222-2222-222222222222', 'Intrus') $$,
  '42501', null, 'A ne peut pas créer un site dans B');
select throws_ok(
  $$ update public.store_locations set store_id = '22222222-2222-2222-2222-222222222222' where store_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'une ligne ne peut pas changer de magasin');

select throws_ok(
  $$ insert into public.store_members (store_id, user_id) values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'aucune écriture directe sur store_members');
select throws_ok(
  $$ insert into public.platform_admins (user_id, level) values ('a0000000-0000-0000-0000-0000000000a1', 'owner') $$,
  '42501', null, 'un utilisateur ne peut pas se promouvoir SuperAdmin');
select is((select count(*)::int from public.platform_admins), 0, 'A ne voit aucun administrateur plateforme');

select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-0000000000a2'), 1, 'A (users.manage) voit le profil de son caissier');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-0000-0000-0000000000b1'), 0, 'A ne voit pas le profil du propriétaire de B');

select ok('settings.manage' = any (public.my_permissions('11111111-1111-1111-1111-111111111111')), 'A a settings.manage dans A');
select is(public.my_permissions('22222222-2222-2222-2222-222222222222'), '{}'::text[], 'A n''a aucune permission dans B');

select cmp_ok((select count(*)::int from public.audit_logs where store_id = '11111111-1111-1111-1111-111111111111'), '>=', 1, 'A voit l''audit de son magasin');
select is((select count(*)::int from public.audit_logs where store_id = '22222222-2222-2222-2222-222222222222'), 0, 'A ne voit pas l''audit de B');

select throws_ok($$ select token_hash from public.store_invitations $$, '42501', null, 'le hachage des jetons est illisible');
select is((select count(*)::int from public.store_invitations), 3, 'A (users.manage) voit les invitations de son magasin');

-- ═════════════ Caissier du magasin A ═════════════
select set_config('app.session_token', 'tok-cashier-a', true);

select results_eq(
  $$ with u as (update public.stores set name = 'Caissier' where id = '11111111-1111-1111-1111-111111111111' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'le caissier ne peut pas modifier le magasin');
select ok('sales.create' = any (public.my_permissions('11111111-1111-1111-1111-111111111111')), 'le caissier peut vendre');
select ok(not ('users.manage' = any (public.my_permissions('11111111-1111-1111-1111-111111111111'))), 'le caissier ne gère pas l''équipe');
select is((select count(*)::int from public.store_members), 1, 'le caissier ne voit que sa propre adhésion');
select is((select count(*)::int from public.store_invitations), 0, 'le caissier ne voit aucune invitation');
select is((select count(*)::int from public.audit_logs), 0, 'le caissier ne voit pas l''audit');
select throws_ok(
  $$ insert into public.store_locations (store_id, name) values ('11111111-1111-1111-1111-111111111111', 'Interdit') $$,
  '42501', null, 'le caissier ne peut pas créer de site');

-- ═════════════ Propriétaire du magasin B ═════════════
select set_config('app.session_token', 'tok-owner-b', true);
select is((select count(*)::int from public.stores), 1, 'B ne voit que son magasin');
select is((select count(*)::int from public.audit_logs where store_id = '11111111-1111-1111-1111-111111111111'), 0, 'B ne voit pas l''audit de A');

-- ═════════════ Utilisateur sans aucun magasin ═════════════
select set_config('app.session_token', 'tok-outsider', true);
select is((select count(*)::int from public.stores), 0, 'un utilisateur sans adhésion ne voit aucun magasin');
select is(public.my_permissions('11111111-1111-1111-1111-111111111111'), '{}'::text[], 'et n''a aucune permission');

-- ═════════════ SuperAdmin : 2FA obligatoire (aal2 = session valide + twoFactorEnabled sur le compte) ═════════════
select set_config('app.session_token', 'tok-admin', true);
select is((select count(*)::int from public.stores), 0, 'SuperAdmin SANS 2FA : aucun accès aux magasins');
select is((select count(*)::int from public.platform_admins), 1, 'mais il voit sa propre ligne (pour activer la 2FA)');
reset role;
update auth."user" set "twoFactorEnabled" = true where id = 'd0000000-0000-0000-0000-0000000000d1';
set local role app_runtime;
select set_config('app.session_token', 'tok-admin', true);
select is((select count(*)::int from public.stores), 2, 'SuperAdmin AVEC 2FA : voit tous les magasins');
reset role;

-- ═════════════ Identité vérifiée par la base : sans session valide, aucun droit ═════════════
set local role app_runtime;
select set_config('app.session_token', '', true);
select is((select count(*)::int from public.stores), 0, 'sans jeton de session : aucune ligne visible');
select set_config('app.session_token', 'jeton-forge-inexistant-xxxx', true);
select is((select count(*)::int from public.stores), 0, 'jeton inconnu (falsifié) : aucune ligne visible');
select set_config('app.session_token', 'tok-expired-a', true);
select is((select count(*)::int from public.stores), 0, 'session expirée : aucune ligne visible');
select is(public.my_permissions('11111111-1111-1111-1111-111111111111'), '{}'::text[], 'session expirée : aucune permission');
select is(private.current_user_id(), null::uuid, 'session expirée : pas d''identité');
select throws_ok($$ select public.accept_invitation('tok-valid-aaaaaaaaaaaa') $$, '28000', null, 'sans session valide : acceptation d''invitation refusée');
select set_config('app.session_token', 'tok-owner-a', true);
select is(private.current_user_id(), 'a0000000-0000-0000-0000-0000000000a1'::uuid, 'session valide : identité retrouvée par la base');
select is(private.current_aal(), 'aal1', 'compte sans 2FA : aal1');

-- ═════════════ Le schéma auth est invisible pour app_runtime ═════════════
select throws_ok($$ select * from auth."user" $$, '42501', null, 'app_runtime ne peut pas lire auth."user"');
select throws_ok($$ select * from auth.session $$, '42501', null, 'app_runtime ne peut pas lire les sessions');
select throws_ok($$ select * from auth.account $$, '42501', null, 'app_runtime ne peut pas lire les hachages de mots de passe');
select throws_ok($$ insert into auth.session (token, "userId", "expiresAt") values ('x', 'a0000000-0000-0000-0000-0000000000a1', now() + interval '1 day') $$,
  '42501', null, 'app_runtime ne peut pas fabriquer une session');
reset role;

-- ═════════════ app_public : aucun accès direct, même avec un jeton valide ═════════════
set local role app_public;
select set_config('app.session_token', 'tok-owner-a', true);
select throws_ok($$ select * from public.stores $$, '42501', null, 'app_public ne peut pas lire stores');
select throws_ok($$ select public.accept_invitation('x') $$, '42501', null, 'app_public ne peut pas appeler accept_invitation');
select throws_ok($$ select * from auth.session $$, '42501', null, 'app_public ne peut pas lire les sessions');
reset role;

-- ═════════════ Magasin en lecture seule (abonnement impayé) ═════════════
update public.stores set access = 'read_only' where id = '11111111-1111-1111-1111-111111111111';
set local role app_runtime;
select set_config('app.session_token', 'tok-owner-a', true);
select results_eq(
  $$ with u as (update public.stores set name = 'Lecture seule' where id = '11111111-1111-1111-1111-111111111111' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'magasin read_only : modification refusée par la base');
select throws_ok(
  $$ insert into public.store_locations (store_id, name) values ('11111111-1111-1111-1111-111111111111', 'Bloqué') $$,
  '42501', null, 'magasin read_only : création refusée par la base');
select is((select count(*)::int from public.stores), 1, 'magasin read_only : lecture toujours possible');
reset role;

-- ═════════════ Invitations ═════════════
set local role app_runtime;
select set_config('app.session_token', 'tok-wrong', true);
select throws_ok($$ select public.accept_invitation('tok-valid-aaaaaaaaaaaa') $$, 'P0001', null, 'mauvaise adresse e-mail : invitation refusée');

select set_config('app.session_token', 'tok-invitee', true);
select throws_ok($$ select public.accept_invitation('jeton-inexistant-xxxxxxx') $$, 'P0001', null, 'jeton inexistant refusé');
select throws_ok($$ select public.accept_invitation('tok-expired-aaaaaaaaaa') $$, 'P0001', null, 'invitation expirée refusée');
select is(public.accept_invitation('tok-valid-aaaaaaaaaaaa'), '11111111-1111-1111-1111-111111111111'::uuid, 'invitation valide acceptée');
select throws_ok($$ select public.accept_invitation('tok-valid-aaaaaaaaaaaa') $$, 'P0001', null, 'invitation à usage unique');
select ok('products.view' = any (public.my_permissions('11111111-1111-1111-1111-111111111111')), 'l''invité a les permissions du rôle manager');

select set_config('app.session_token', 'tok-suspended', true);
select lives_ok($$ select public.accept_invitation('tok-suspended-aaaaaaa') $$, 'un membre suspendu peut utiliser une invitation (sans effet de réactivation)');
select is(public.my_permissions('11111111-1111-1111-1111-111111111111'), '{}'::text[], 'un membre suspendu n''a toujours aucune permission');
reset role;

select is((select status from public.store_members where store_id = '11111111-1111-1111-1111-111111111111' and user_id = 'f0000000-0000-0000-0000-0000000000f1'),
          'suspended', 'une invitation ne réactive jamais un membre suspendu');
select is((select count(*)::int from public.store_members where store_id = '11111111-1111-1111-1111-111111111111' and user_id = 'e0000000-0000-0000-0000-0000000000e1' and status = 'active'),
          1, 'le membre invité est actif');

-- ═════════════ Journaux en ajout seul (même pour le propriétaire de la base) ═════════════
select throws_ok($$ update public.audit_logs set action = 'falsifié' $$, '42501', null, 'audit_logs : UPDATE interdit');
select throws_ok($$ delete from public.audit_logs $$, '42501', null, 'audit_logs : DELETE interdit');
select throws_ok($$ truncate public.audit_logs $$, '42501', null, 'audit_logs : TRUNCATE interdit');

-- ═════════ Immutabilité du code QR ═════════
select throws_ok(
  $$ update public.stores set public_code = 'nouveaucode' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'public_code (QR) est immuable');

select * from finish();
rollback;
