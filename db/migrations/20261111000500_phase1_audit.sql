-- Phase 1B / 500 : journaux d'audit et de sécurité (ajout seul)
-- Impact données existantes : aucun (création uniquement).

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid references public.stores (id),   -- NULL = événement de plateforme
  actor_id    uuid,                                  -- pas de FK : le journal survit à la suppression d'un compte
  action      text not null,
  entity_type text,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_store_created_idx on public.audit_logs (store_id, created_at desc);

create table public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  identifier text,        -- jamais de mot de passe ; e-mail haché côté application si nécessaire
  success    boolean not null,
  ip         inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.security_events (
  id         uuid primary key default gen_random_uuid(),
  severity   text not null check (severity in ('info', 'warning', 'critical')),
  event_type text not null,
  user_id    uuid,
  store_id   uuid,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Ajout seul : ni UPDATE, ni DELETE, ni TRUNCATE (même pour les rôles privilégiés).
do $$
declare t text;
begin
  foreach t in array array['audit_logs', 'login_events', 'security_events'] loop
    execute format('create trigger %I before update or delete on public.%I for each row execute function private.forbid_modification()', t || '_no_modify', t);
    execute format('create trigger %I before truncate on public.%I for each statement execute function private.forbid_modification()', t || '_no_truncate', t);
  end loop;
end
$$;
