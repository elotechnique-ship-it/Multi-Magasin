import type { MenuEntry, MenuItem } from "./types.ts";

/** Menu du noyau. Les modules métier (Phase 4) ajouteront leurs entrées via leur manifeste. */
export const CORE_MENU: readonly MenuItem[] = [
  { id: "dashboard", label: "Tableau de bord", href: "", icon: "layout-dashboard", permission: null, module: null, status: "ready" },
  { id: "pos", label: "Caisse", href: "caisse", icon: "shopping-cart", permission: "sales.create", module: "sales", status: "planned" },
  { id: "products", label: "Produits", href: "produits", icon: "package", permission: "products.view", module: "products", status: "planned" },
  { id: "stock", label: "Stock", href: "stock", icon: "boxes", permission: "stock.view", module: "stock", status: "planned" },
  { id: "sales", label: "Ventes", href: "ventes", icon: "receipt", permission: "sales.view", module: "sales", status: "planned" },
  { id: "customers", label: "Clients", href: "clients", icon: "users", permission: "customers.view", module: "customers", status: "planned" },
  { id: "suppliers", label: "Fournisseurs", href: "fournisseurs", icon: "truck", permission: "suppliers.view", module: "suppliers", status: "planned" },
  { id: "purchases", label: "Achats", href: "achats", icon: "clipboard-list", permission: "purchases.manage", module: "suppliers", status: "planned" },
  { id: "finance", label: "Finances", href: "finances", icon: "wallet", permission: "finance.view", module: "finance", status: "planned" },
  { id: "orders", label: "Commandes en ligne", href: "commandes", icon: "shopping-bag", permission: "orders.view", module: "orders", status: "planned" },
  { id: "marketing", label: "Marketing", href: "marketing", icon: "megaphone", permission: "marketing.manage", module: "marketing", status: "planned" },
  { id: "team", label: "Équipe", href: "equipe", icon: "user-cog", permission: "users.manage", module: "team", status: "planned" },
  { id: "settings", label: "Paramètres", href: "parametres", icon: "settings", permission: "settings.manage", module: "settings", status: "planned" },
];

/**
 * Construit le menu d'un magasin : entrée visible si (permission accordée) ET (module activé).
 * NB : ce filtrage améliore l'ergonomie ; la sécurité réelle est appliquée par la base (RLS/RPC).
 */
export function buildMenu(
  permissions: ReadonlySet<string>,
  enabledModules: ReadonlySet<string>,
  items: readonly MenuItem[] = CORE_MENU,
): MenuEntry[] {
  return items
    .filter((i) => (i.permission === null || permissions.has(i.permission)) && (i.module === null || enabledModules.has(i.module)))
    .map((i) => ({ id: i.id, label: i.label, href: i.href, icon: i.icon, enabled: i.status === "ready" }));
}
