import { AppShell } from "@/components/layout/app-shell";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { MenuEntry } from "@/lib/modules/types";

const MENU: MenuEntry[] = [
  { id: "dashboard", label: "Tableau de bord", href: "dashboard", icon: "layout-dashboard", enabled: true },
  { id: "stores", label: "Magasins", href: "magasins", icon: "store", enabled: false },
  { id: "categories", label: "Catégories", href: "categories", icon: "tags", enabled: false },
  { id: "subscriptions", label: "Abonnements", href: "abonnements", icon: "credit-card", enabled: false },
  { id: "payments", label: "Paiements", href: "paiements", icon: "wallet", enabled: false },
  { id: "users", label: "Utilisateurs", href: "utilisateurs", icon: "users", enabled: false },
  { id: "support", label: "Support", href: "support", icon: "life-buoy", enabled: false },
  { id: "reports", label: "Rapports", href: "rapports", icon: "bar-chart", enabled: false },
  { id: "settings", label: "Paramètres", href: "parametres", icon: "settings", enabled: false },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { identity } = await requirePlatformAdmin();
  return (
    <AppShell title="Plateforme" area="SuperAdmin" basePath="/superadmin" menu={MENU} userEmail={identity.email}>
      {children}
    </AppShell>
  );
}
