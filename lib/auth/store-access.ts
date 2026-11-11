import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isValidSlug } from "@/lib/validation/slug";

export interface StoreContext {
  id: string;
  slug: string;
  name: string;
  status: "pending_activation" | "active" | "suspended" | "archived";
  access: "full" | "read_only" | "blocked";
}

/**
 * Contexte du magasin actif (issu de l'URL). Jamais de confiance dans l'URL seule :
 * la lecture du magasin passe par la RLS ; si l'utilisateur n'est pas membre, la ligne est invisible.
 * Aucune permission => 404 (on ne révèle pas l'existence d'un magasin à un non-membre).
 */
export async function requireStoreAccess(storeSlug: string) {
  if (!isValidSlug(storeSlug)) notFound();
  const { supabase, user } = await requireUser(`/magasin/${storeSlug}`);

  const { data: store } = await supabase
    .from("stores")
    .select("id, slug, name, status, access")
    .eq("slug", storeSlug)
    .maybeSingle();
  if (!store) notFound();

  const { data: perms } = await supabase.rpc("my_permissions", { p_store: (store as StoreContext).id });
  const permissions = new Set<string>(Array.isArray(perms) ? (perms as string[]) : []);
  if (permissions.size === 0) notFound();

  const { data: mods } = await supabase
    .from("store_modules")
    .select("module_code")
    .eq("store_id", (store as StoreContext).id)
    .eq("is_enabled", true);
  const modules = new Set<string>((mods ?? []).map((m: { module_code: string }) => m.module_code));

  return { supabase, user, store: store as StoreContext, permissions, modules };
}
