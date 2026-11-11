// Catalogue des permissions. DOIT correspondre exactement à la table public.permissions
// (vérifié par scripts/check-permission-drift.mjs).
export const PERMISSIONS = [
  "products.view", "products.create", "products.update", "products.delete", "products.update_price", "products.view_cost",
  "stock.view", "stock.adjust", "stock.transfer", "stock.count",
  "sales.create", "sales.cancel", "sales.return", "sales.discount", "sales.discount_limited", "sales.view", "sales.view_profit",
  "cash.open", "cash.close",
  "customers.view", "customers.manage", "customers.manage_credit",
  "suppliers.view", "suppliers.manage", "purchases.manage", "purchases.receive",
  "finance.view", "finance.manage", "reports.view",
  "orders.view", "orders.manage", "orders.deliver",
  "marketing.manage", "users.manage", "settings.manage",
  "billing.view", "billing.manage", "audit.view", "locations.manage",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is PermissionCode {
  return (PERMISSIONS as readonly string[]).includes(value);
}
