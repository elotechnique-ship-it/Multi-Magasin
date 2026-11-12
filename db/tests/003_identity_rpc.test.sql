-- pgTAP : my_identity() (lot B2). Données fictives, transaction annulée.
begin;
select * from no_plan();

insert into auth."user" (id, name, email, "twoFactorEnabled") values
  ('a1000000-0000-0000-0000-000000000001', 'Alice', 'alice@test.local', true),
  ('b1000000-0000-0000-0000-000000000002', 'Bob', 'bob@test.local', false);
insert into auth.session (token, "userId", "expiresAt") values
  ('tok-alice',   'a1000000-0000-0000-0000-000000000001', now() + interval '1 hour'),
  ('tok-bob',     'b1000000-0000-0000-0000-000000000002', now() + interval '1 hour'),
  ('tok-expired', 'a1000000-0000-0000-0000-000000000001', now() - interval '1 hour');

set local role app_runtime;

select set_config('app.session_token', 'tok-alice', true);
select is((select count(*)::int from public.my_identity()), 1, 'session valide : exactement une ligne');
select is((select email from public.my_identity()), 'alice@test.local', 'session valide : sa propre adresse e-mail');
select is((select aal from public.my_identity()), 'aal2', 'compte avec 2FA : aal2');
select is((select count(*)::int from public.my_identity() where email = 'bob@test.local'), 0, 'jamais l''identité d''un autre utilisateur');

select set_config('app.session_token', 'tok-bob', true);
select is((select email from public.my_identity()), 'bob@test.local', 'autre session : autre identité');
select is((select aal from public.my_identity()), 'aal1', 'compte sans 2FA : aal1');

select set_config('app.session_token', 'tok-expired', true);
select is((select count(*)::int from public.my_identity()), 0, 'session expirée : aucune identité');
select set_config('app.session_token', 'jeton-inconnu-xxxxxxxx', true);
select is((select count(*)::int from public.my_identity()), 0, 'jeton inconnu : aucune identité');
select set_config('app.session_token', '', true);
select is((select count(*)::int from public.my_identity()), 0, 'sans jeton : aucune identité');

reset role;
set local role app_public;
select throws_ok($$ select * from public.my_identity() $$, '42501', null, 'app_public ne peut pas appeler my_identity');
reset role;

select * from finish();
rollback;
