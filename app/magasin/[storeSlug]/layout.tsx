import { AppShell } from "@/components/layout/app-shell";
import { requireStoreAccess } from "@/lib/auth/store-access";
import { fr } from "@/lib/i18n/fr";
import { buildMenu } from "@/lib/modules/registry";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const { identity, store, permissions, modules } = await requireStoreAccess(storeSlug);

  const banner =
    store.access === "blocked" || store.status === "suspended"
      ? fr.shell.blocked
      : store.access === "read_only"
        ? fr.shell.readOnly
        : store.status === "pending_activation"
          ? "Magasin en attente d’activation par l’équipe de la plateforme."
          : undefined;

  return (
    <AppShell
      title={store.name}
      area="Espace commerçant"
      basePath={`/magasin/${store.slug}`}
      menu={buildMenu(permissions, modules)}
      userEmail={identity.email}
      banner={banner}
    >
      {children}
    </AppShell>
  );
}
