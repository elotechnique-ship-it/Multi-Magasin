import type { TxClient } from "@/lib/db/session-tx";

export interface Identity {
  user_id: string;
  email: string;
  name: string;
  two_factor_enabled: boolean;
  aal: "aal1" | "aal2";
}

/** Identité de l'utilisateur de la session courante, retrouvée PAR LA BASE (aucun accès direct au schéma auth). */
export async function getIdentity(tx: TxClient): Promise<Identity | null> {
  const { rows } = await tx.query<Identity>("select user_id, email, name, two_factor_enabled, aal from public.my_identity()");
  return rows[0] ?? null;
}

export interface PlatformAdminRow {
  level: "owner" | "support" | "finance";
  disabled_at: string | null;
}

export async function getPlatformAdmin(tx: TxClient): Promise<PlatformAdminRow | null> {
  const { rows } = await tx.query<PlatformAdminRow>(
    "select level, disabled_at from public.platform_admins where user_id = private.current_user_id()",
  );
  return rows[0] ?? null;
}
