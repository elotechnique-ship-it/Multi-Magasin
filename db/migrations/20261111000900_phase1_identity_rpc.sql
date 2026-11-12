-- Phase 1B / 900 : identité de l'utilisateur courant exposée à l'application SANS lui ouvrir le schéma auth.
-- Retourne 0 ligne sans session valide ; ne renvoie JAMAIS les données d'un autre utilisateur.
-- Impact données existantes : aucun (création de fonction).

create or replace function public.my_identity()
returns table (user_id uuid, email text, name text, two_factor_enabled boolean, aal text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         u.email,
         u.name,
         u."twoFactorEnabled",
         case when u."twoFactorEnabled" then 'aal2' else 'aal1' end
  from auth.session s
  join auth."user" u on u.id = s."userId"
  where s.token = nullif(current_setting('app.session_token', true), '')
    and s."expiresAt" > now()
$$;

revoke all on function public.my_identity() from public, app_public;
grant execute on function public.my_identity() to app_runtime;
