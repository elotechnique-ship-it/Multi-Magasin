import "server-only";
import { notFound, redirect } from "next/navigation";
import { withSession } from "@/lib/db/with-session";
import { getIdentity, getPlatformAdmin, type Identity } from "@/lib/db/queries/identity";
import { getCurrentSessionToken } from "@/lib/auth/current-session";

export type PlatformLevel = "owner" | "support" | "finance";

/** Jeton de session valide ou redirection vers la connexion. */
export async function requireSessionToken(nextPath?: string): Promise<string> {
  const token = await getCurrentSessionToken();
  if (!token) {
    const q = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/auth/connexion${q}`);
  }
  return token;
}

/** Utilisateur authentifié : l'identité est retrouvée PAR LA BASE ; une session expirée ou falsifiée donne null => connexion. */
export async function requireIdentity(nextPath?: string): Promise<{ token: string; identity: Identity }> {
  const token = await requireSessionToken(nextPath);
  const identity = await withSession(token, (tx) => getIdentity(tx), { readOnly: true });
  if (!identity) redirect(nextPath ? `/auth/connexion?next=${encodeURIComponent(nextPath)}` : "/auth/connexion");
  return { token, identity };
}

/**
 * Garde SuperAdmin. 404 si l'utilisateur n'est pas administrateur (on ne révèle pas l'existence de la zone).
 * 2FA obligatoire : sans aal2 → page d'activation. La base applique la même règle (private.platform_level exige aal2).
 */
export async function requirePlatformAdmin(nextPath = "/superadmin/dashboard") {
  const { token, identity } = await requireIdentity(nextPath);
  const admin = await withSession(token, (tx) => getPlatformAdmin(tx), { readOnly: true });
  if (!admin || admin.disabled_at) notFound();
  if (identity.aal !== "aal2") redirect(`/auth/mfa?next=${encodeURIComponent(nextPath)}`);
  return { token, identity, level: admin.level as PlatformLevel };
}
