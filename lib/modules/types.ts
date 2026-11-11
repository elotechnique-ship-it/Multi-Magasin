import type { PermissionCode } from "../permissions/catalog.ts";

export type IconName =
  | "layout-dashboard" | "shopping-cart" | "package" | "boxes" | "receipt" | "users" | "truck"
  | "clipboard-list" | "wallet" | "shopping-bag" | "megaphone" | "user-cog" | "settings"
  | "store" | "tags" | "credit-card" | "life-buoy" | "bar-chart";

export interface MenuItem {
  id: string;
  label: string;
  /** Segment relatif à /magasin/[storeSlug]/ ("" = tableau de bord). */
  href: string;
  icon: IconName;
  /** null = visible par tout membre actif du magasin. */
  permission: PermissionCode | null;
  /** Module requis (public.modules.code). null = toujours actif. */
  module: string | null;
  /** "planned" : affiché désactivé avec la mention « Bientôt ». */
  status: "ready" | "planned";
}

export interface ModuleManifest {
  code: string;
  label: string;
  requiresCapabilities: readonly string[];
  menu: readonly MenuItem[];
  permissions: readonly PermissionCode[];
}

export interface MenuEntry {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  enabled: boolean;
}
