import { notFound, redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type PlatformLevel = "owner" | "support" | "finance";

/** Utilisateur authentifié (JWT validé côté serveur Auth) ou redirection vers la connexion. */
export async function requireUser(nextPath?: string): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const q = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/auth/connexion${q}`);
  }
  return { supabase, user };
}

/**
 * Garde SuperAdmin. Réponse 404 si l'utilisateur n'est pas administrateur (on ne révèle pas l'existence de la zone).
 * MFA obligatoire : sans AAL2 → redirection vers l'enrôlement/vérification TOTP.
 * NB : la base applique la même règle (private.platform_level exige aal2) — ce garde n'est qu'ergonomique.
 */
export async function requirePlatformAdmin(nextPath = "/superadmin/dashboard") {
  const { supabase, user } = await requireUser(nextPath);

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("level, disabled_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin || admin.disabled_at) notFound();

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect(`/auth/mfa?next=${encodeURIComponent(nextPath)}`);

  return { supabase, user, level: admin.level as PlatformLevel };
}
