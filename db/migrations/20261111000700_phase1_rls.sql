-- Phase 1B / 700 : RLS + privilèges (deny by default)
-- Toutes les tables de public : RLS activée ET forcée. Aucun accès pour app_public ni app_auth.
-- app_runtime : uniquement les privilèges listés ci-dessous, restreints par colonne quand c'est utile.
-- Le propriétaire (app_migrator) est BYPASSRLS : il ne sert qu'aux migrations.
-- Impact données existantes : aucun. Aucune politique n'est désactivée.

-- 1. Retrait de tout privilège de table pour les rôles applicatifs (base saine quel que soit l'historique).
revoke all on all tables in schema public from app_runtime, app_public, app_auth;
revoke all on all sequences in schema public from app_runtime, app_public, app_auth;

-- 2. Activation et forçage de la RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'store_categories','modules','category_modules','category_fields','subscription_plans','plan_features',
    'platform_settings','platform_admins','stores','store_slug_history','store_settings','store_modules',
    'store_locations','profiles','permissions','roles','role_permissions','store_members','member_roles',
    'store_invitations','audit_logs','login_events','security_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

-- ───────── Référentiels : lecture pour tout utilisateur connecté ; écriture réservée au propriétaire plateforme ─────────
grant select on public.store_categories, public.modules, public.category_modules, public.category_fields,
                public.subscription_plans, public.plan_features, public.permissions, public.role_permissions
  to app_runtime;
grant insert, update on public.store_categories, public.modules, public.category_modules, public.category_fields,
                        public.subscription_plans, public.plan_features
  to app_runtime;

do $$
declare t text;
begin
  foreach t in array array['store_categories','modules','category_modules','category_fields','subscription_plans','plan_features'] loop
    execute format('create policy %I on public.%I for select to app_runtime using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to app_runtime with check (private.platform_has_level(array[''owner'']))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to app_runtime using (private.platform_has_level(array[''owner''])) with check (private.platform_has_level(array[''owner'']))', t || '_update', t);
  end loop;
end
$$;

create policy permissions_select on public.permissions for select to app_runtime using (true);
create policy role_permissions_select on public.role_permissions for select to app_runtime using (true);

-- ───────── Plateforme ─────────
grant select on public.platform_admins to app_runtime;
-- Chacun peut voir sa propre ligne (pour savoir s'il doit passer la MFA) ; le propriétaire plateforme voit tout.
-- AUCUNE policy ni privilège d'écriture : promotion uniquement par procédure d'administration.
create policy platform_admins_select on public.platform_admins for select to app_runtime
  using (user_id = (select private.current_user_id()) or private.platform_has_level(array['owner']));

grant select, insert, update on public.platform_settings to app_runtime;
create policy platform_settings_select on public.platform_settings for select to app_runtime
  using (private.is_platform_admin());
create policy platform_settings_insert on public.platform_settings for insert to app_runtime
  with check (private.platform_has_level(array['owner']));
create policy platform_settings_update on public.platform_settings for update to app_runtime
  using (private.platform_has_level(array['owner'])) with check (private.platform_has_level(array['owner']));

-- ───────── Magasins ─────────
grant select on public.stores to app_runtime;
-- Un magasin ne peut modifier que son nom et son thème. slug, statut, accès, catégorie, code QR : via fonctions dédiées.
grant update (name, theme) on public.stores to app_runtime;
create policy stores_select on public.stores for select to app_runtime
  using (private.is_store_member(id) or private.is_platform_admin());
create policy stores_update on public.stores for update to app_runtime
  using (private.has_permission(id, 'settings.manage') and private.store_is_writable(id))
  with check (private.has_permission(id, 'settings.manage') and private.store_is_writable(id));

grant select on public.store_slug_history to app_runtime;
create policy store_slug_history_select on public.store_slug_history for select to app_runtime
  using (private.is_store_member(store_id) or private.is_platform_admin());

grant select on public.store_settings to app_runtime;
grant update (settings) on public.store_settings to app_runtime;
create policy store_settings_select on public.store_settings for select to app_runtime
  using (private.is_store_member(store_id) or private.is_platform_admin());
create policy store_settings_update on public.store_settings for update to app_runtime
  using (private.has_permission(store_id, 'settings.manage') and private.store_is_writable(store_id))
  with check (private.has_permission(store_id, 'settings.manage') and private.store_is_writable(store_id));

grant select, insert, update on public.store_modules to app_runtime;
create policy store_modules_select on public.store_modules for select to app_runtime
  using (private.is_store_member(store_id) or private.is_platform_admin());
create policy store_modules_insert on public.store_modules for insert to app_runtime
  with check (private.platform_has_level(array['owner']));
create policy store_modules_update on public.store_modules for update to app_runtime
  using (private.platform_has_level(array['owner'])) with check (private.platform_has_level(array['owner']));

grant select on public.store_locations to app_runtime;
grant insert (store_id, name, kind) on public.store_locations to app_runtime;
grant update (name, kind, is_active) on public.store_locations to app_runtime;
create policy store_locations_select on public.store_locations for select to app_runtime
  using (private.is_store_member(store_id) or private.is_platform_admin());
create policy store_locations_insert on public.store_locations for insert to app_runtime
  with check (private.has_permission(store_id, 'locations.manage') and private.store_is_writable(store_id));
create policy store_locations_update on public.store_locations for update to app_runtime
  using (private.has_permission(store_id, 'locations.manage') and private.store_is_writable(store_id))
  with check (private.has_permission(store_id, 'locations.manage') and private.store_is_writable(store_id));

-- ───────── Identité ─────────
grant select on public.profiles to app_runtime;
grant update (full_name, phone, avatar_path, locale) on public.profiles to app_runtime;
create policy profiles_select on public.profiles for select to app_runtime
  using (id = (select private.current_user_id()) or private.can_manage_user_of(id) or private.is_platform_admin());
create policy profiles_update on public.profiles for update to app_runtime
  using (id = (select private.current_user_id())) with check (id = (select private.current_user_id()));

grant select on public.roles to app_runtime;
create policy roles_select on public.roles for select to app_runtime
  using (store_id is null or private.is_store_member(store_id) or private.is_platform_admin());

-- Membres et rôles : lecture seule côté client. Toute écriture passe par des fonctions privilégiées (RPC).
grant select on public.store_members to app_runtime;
create policy store_members_select on public.store_members for select to app_runtime
  using (user_id = (select private.current_user_id()) or private.has_permission(store_id, 'users.manage') or private.is_platform_admin());

grant select on public.member_roles to app_runtime;
create policy member_roles_select on public.member_roles for select to app_runtime
  using (
    exists (
      select 1 from public.store_members m
      where m.id = member_roles.member_id
        and (m.user_id = (select private.current_user_id()) or private.has_permission(m.store_id, 'users.manage'))
    )
    or private.is_platform_admin()
  );

-- Invitations : le hachage du jeton n'est JAMAIS lisible par un client (privilège par colonne).
grant select (id, store_id, email, role_id, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  on public.store_invitations to app_runtime;
create policy store_invitations_select on public.store_invitations for select to app_runtime
  using (private.has_permission(store_id, 'users.manage') or private.is_platform_admin());

-- ───────── Audit et sécurité ─────────
grant select on public.audit_logs to app_runtime;
create policy audit_logs_select on public.audit_logs for select to app_runtime
  using ((store_id is not null and private.has_permission(store_id, 'audit.view')) or private.is_platform_admin());

grant select on public.login_events, public.security_events to app_runtime;
create policy login_events_select on public.login_events for select to app_runtime
  using (private.is_platform_admin());
create policy security_events_select on public.security_events for select to app_runtime
  using (private.is_platform_admin());
