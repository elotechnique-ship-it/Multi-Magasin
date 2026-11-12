import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { withSession } from "@/lib/db/with-session";
import { getEnabledModules, getMyPermissions, getStoreBySlug, type StoreRow } from "@/lib/db/queries/stores";
import { isValidSlug } from "@/lib/validation/slug";

export type StoreContext = StoreRow;

/**
 * Contexte du magasin actif (issu de l'URL). Jamais de confiance dans l'URL seule : une seule transaction sous session,
 * la RLS ne renvoie le magasin qu'à un membre. Aucune permission => 404 (pas d'indice d'existence pour un non-membre).
 */
export async function requireStoreAccess(storeSlug: string) {
  if (!isValidSlug(storeSlug)) notFound();
  const { token, identity } = await requireIdentity(`/magasin/${storeSlug}`);

  const ctx = await withSession(
    token,
    async (tx) => {
      const store = await getStoreBySlug(tx, storeSlug);
      if (!store) return null;
      const [permissions, modules] = await Promise.all([getMyPermissions(tx, store.id), getEnabledModules(tx, store.id)]);
      return { store, permissions, modules };
    },
    { readOnly: true },
  );
  if (!ctx || ctx.permissions.length === 0) notFound();

  return { identity, store: ctx.store, permissions: new Set(ctx.permissions), modules: new Set(ctx.modules) };
}
