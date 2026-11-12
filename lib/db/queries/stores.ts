import type { TxClient } from "@/lib/db/session-tx";

export interface StoreRow {
  id: string;
  slug: string;
  name: string;
  status: "pending_activation" | "active" | "suspended" | "archived";
  access: "full" | "read_only" | "blocked";
}

export interface MyStoreRow {
  slug: string;
  name: string;
  status: StoreRow["status"];
}

/** Magasins dont l'utilisateur est membre actif (et non tous ceux qu'il peut voir, ex. un administrateur plateforme). */
export async function listMyStores(tx: TxClient): Promise<MyStoreRow[]> {
  const { rows } = await tx.query<MyStoreRow>(
    `select s.slug, s.name, s.status
       from public.store_members m
       join public.stores s on s.id = m.store_id
      where m.user_id = private.current_user_id() and m.status = 'active'
      order by s.name`,
  );
  return rows;
}

/** Magasin par slug. La RLS ne renvoie la ligne qu'à un membre : un non-membre obtient null (jamais d'indice d'existence). */
export async function getStoreBySlug(tx: TxClient, slug: string): Promise<StoreRow | null> {
  const { rows } = await tx.query<StoreRow>("select id, slug, name, status, access from public.stores where slug = $1", [slug]);
  return rows[0] ?? null;
}

export async function getMyPermissions(tx: TxClient, storeId: string): Promise<string[]> {
  const { rows } = await tx.query<{ permissions: string[] | null }>("select public.my_permissions($1::uuid) as permissions", [storeId]);
  return rows[0]?.permissions ?? [];
}

export async function getEnabledModules(tx: TxClient, storeId: string): Promise<string[]> {
  const { rows } = await tx.query<{ module_code: string }>(
    "select module_code from public.store_modules where store_id = $1::uuid and is_enabled",
    [storeId],
  );
  return rows.map((r) => r.module_code);
}

/** Acceptation d'une invitation : la base vérifie le jeton, l'e-mail et l'expiration. Retourne l'identifiant du magasin. */
export async function acceptInvitationRpc(tx: TxClient, token: string): Promise<string> {
  const { rows } = await tx.query<{ store_id: string }>("select public.accept_invitation($1::text) as store_id", [token]);
  const id = rows[0]?.store_id;
  if (!id) throw new Error("invitation invalide");
  return id;
}
