-- Phase 1B / 600 : identité vérifiée PAR LA BASE (variante B-2), fonctions d'aide RLS, journal d'audit, RPC
-- Règles : SECURITY DEFINER => search_path vidé + noms qualifiés ; EXECUTE accordé explicitement ;
-- jamais accordé à PUBLIC. Impact données existantes : aucun (création de fonctions).
--
-- Principe B-2 : l'application transmet UNIQUEMENT le jeton de session, dans la transaction courante :
--     select set_config('app.session_token', <jeton>, true);
-- La base retrouve l'utilisateur et son niveau MFA dans auth.session ; elle ne croit aucune identité "affirmée".
-- Sans jeton, avec un jeton inconnu, expiré ou falsifié : current_user_id() est NULL => aucun droit.

create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s."userId"
  from auth.session s
  where s.token = nullif(current_setting('app.session_token', true), '')
    and s."expiresAt" > now()
$$;

-- aal2 = session valide ET double authentification activée sur le compte.
-- (Better Auth ne crée aucune session avant la vérification du second facteur : voir docs/b0-decision-note.md §2.2.)
create or replace function private.current_aal()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when u."twoFactorEnabled" then 'aal2' else 'aal1' end
  from auth.session s
  join auth."user" u on u.id = s."userId"
  where s.token = nullif(current_setting('app.session_token', true), '')
    and s."expiresAt" > now()
$$;

create or replace function private.platform_level()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.level
  from public.platform_admins a
  where a.user_id = (select private.current_user_id())
    and a.disabled_at is null
    and (select private.current_aal()) = 'aal2'
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.platform_level() is not null
$$;

create or replace function private.platform_has_level(p_levels text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.platform_level() = any (p_levels), false)
$$;

create or replace function private.is_store_member(p_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members m
    where m.store_id = p_store
      and m.user_id = (select private.current_user_id())
      and m.status = 'active'
  )
$$;

create or replace function private.has_permission(p_store uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members m
    join public.member_roles mr on mr.member_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    where m.store_id = p_store
      and m.user_id = (select private.current_user_id())
      and m.status = 'active'
      and rp.permission_code = p_perm
  )
$$;

create or replace function private.store_is_writable(p_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = p_store
      and s.status = 'active'
      and s.access = 'full'
  )
$$;

create or replace function private.can_manage_user_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members tm
    where tm.user_id = p_user
      and tm.status = 'active'
      and private.has_permission(tm.store_id, 'users.manage')
  )
$$;

create or replace function private.write_audit(
  p_store uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (store_id, actor_id, action, entity_type, entity_id, detail)
  values (p_store, (select private.current_user_id()), p_action, p_entity_type, p_entity_id, coalesce(p_detail, '{}'::jsonb))
$$;

revoke all on function private.current_user_id() from public;
revoke all on function private.current_aal() from public;
grant execute on function private.current_user_id() to app_runtime;
grant execute on function private.current_aal() to app_runtime;
grant execute on function private.platform_level() to app_runtime;
grant execute on function private.is_platform_admin() to app_runtime;
grant execute on function private.platform_has_level(text[]) to app_runtime;
grant execute on function private.is_store_member(uuid) to app_runtime;
grant execute on function private.has_permission(uuid, text) to app_runtime;
grant execute on function private.store_is_writable(uuid) to app_runtime;
grant execute on function private.can_manage_user_of(uuid) to app_runtime;
-- private.write_audit : volontairement NON accordé à l'application (appelé par d'autres fonctions privilégiées).

-- ───────── RPC appelées par l'application (rôle app_runtime) ─────────

create or replace function public.my_permissions(p_store uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct rp.permission_code order by rp.permission_code), '{}'::text[])
  from public.store_members m
  join public.member_roles mr on mr.member_id = m.id
  join public.role_permissions rp on rp.role_id = mr.role_id
  where m.store_id = p_store
    and m.user_id = (select private.current_user_id())
    and m.status = 'active'
$$;

-- Acceptation d'une invitation : rattache l'utilisateur de la session courante au magasin.
-- Message d'erreur volontairement générique (pas de fuite sur l'existence du jeton).
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select private.current_user_id());
  v_email  text;
  v_inv    public.store_invitations%rowtype;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select lower(u.email) into v_email from auth."user" u where u.id = v_uid;

  select * into v_inv
  from public.store_invitations i
  where i.token_hash = sha256(convert_to(coalesce(p_token, ''), 'utf8'))
  for update;

  if not found
     or v_inv.accepted_at is not null
     or v_inv.revoked_at is not null
     or v_inv.expires_at < now()
     or v_email is null
     or lower(v_inv.email) <> v_email then
    raise exception 'invalid invitation' using errcode = 'P0001';
  end if;

  insert into public.store_members (store_id, user_id, status)
  values (v_inv.store_id, v_uid, 'active')
  on conflict (store_id, user_id) do nothing
  returning id into v_member;

  -- Membre déjà existant (par ex. suspendu) : on ne modifie JAMAIS son statut ici.
  if v_member is null then
    select m.id into v_member
    from public.store_members m
    where m.store_id = v_inv.store_id and m.user_id = v_uid;
  end if;

  insert into public.member_roles (member_id, role_id)
  values (v_member, v_inv.role_id)
  on conflict do nothing;

  update public.store_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  perform private.write_audit(v_inv.store_id, 'invitation.accepted', 'store_invitation', v_inv.id,
                              jsonb_build_object('member_id', v_member));
  return v_inv.store_id;
end
$$;

revoke all on function public.my_permissions(uuid) from public, app_public;
revoke all on function public.accept_invitation(text) from public, app_public;
grant execute on function public.my_permissions(uuid) to app_runtime;
grant execute on function public.accept_invitation(text) to app_runtime;
