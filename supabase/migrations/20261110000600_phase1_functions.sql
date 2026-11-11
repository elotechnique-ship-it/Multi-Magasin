-- Phase 1.4 / 600 : fonctions d'aide RLS, journal d'audit, RPC du noyau
-- Règles : SECURITY DEFINER => search_path vidé + noms qualifiés ; EXECUTE accordé explicitement ;
-- jamais accordé à anon. Impact données existantes : aucun (création de fonctions).

-- Niveau d'administrateur de plateforme de l'utilisateur courant (NULL s'il n'en est pas un).
-- MFA obligatoire : sans session AAL2 le résultat est NULL, donc aucun droit plateforme.
create or replace function private.platform_level()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.level
  from public.platform_admins a
  where a.user_id = (select auth.uid())
    and a.disabled_at is null
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
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
      and m.user_id = (select auth.uid())
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
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission_code = p_perm
  )
$$;

-- Le magasin accepte-t-il les écritures métier ? (actif + abonnement en règle)
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

-- Le profil p_user appartient-il à un magasin où l'utilisateur courant gère les utilisateurs ?
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

-- Écriture du journal d'audit (seul point d'écriture ; aucun client n'a de droit INSERT direct).
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
  values (p_store, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_detail, '{}'::jsonb))
$$;

grant execute on function private.platform_level() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.platform_has_level(text[]) to authenticated;
grant execute on function private.is_store_member(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.store_is_writable(uuid) to authenticated;
grant execute on function private.can_manage_user_of(uuid) to authenticated;
-- private.write_audit : volontairement NON accordé aux clients (appelé par d'autres fonctions privilégiées).

-- ───────── RPC publiques (exposées à l'API) ─────────

-- Permissions de l'utilisateur courant dans un magasin (vide s'il n'en est pas membre actif).
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
    and m.user_id = (select auth.uid())
    and m.status = 'active'
$$;

-- Acceptation d'une invitation : rattache l'utilisateur connecté au magasin.
-- Message d'erreur volontairement générique (pas de fuite sur l'existence du jeton).
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_email  text;
  v_inv    public.store_invitations%rowtype;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

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

revoke all on function public.my_permissions(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.my_permissions(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
