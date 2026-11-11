import { describe, expect, it } from "vitest";
import { buildMenu } from "@/lib/modules/registry";
import { PERMISSIONS, isPermission } from "@/lib/permissions/catalog";

describe("buildMenu", () => {
  it("n'affiche que ce que les permissions et modules autorisent", () => {
    const menu = buildMenu(new Set(["settings.manage"]), new Set(["settings"]));
    expect(menu.map((m) => m.id)).toEqual(["dashboard", "settings"]);
  });
  it("masque une entrée dont le module n'est pas activé", () => {
    const menu = buildMenu(new Set(["sales.create", "products.view"]), new Set(["products"]));
    expect(menu.map((m) => m.id)).toEqual(["dashboard", "products"]);
  });
  it("le tableau de bord est visible par tout membre", () => {
    expect(buildMenu(new Set(), new Set()).map((m) => m.id)).toEqual(["dashboard"]);
  });
  it("seules les entrées prêtes sont actives", () => {
    const menu = buildMenu(new Set(["settings.manage"]), new Set(["settings"]));
    expect(menu.find((m) => m.id === "dashboard")?.enabled).toBe(true);
    expect(menu.find((m) => m.id === "settings")?.enabled).toBe(false);
  });
});

describe("catalogue de permissions", () => {
  it("n'a pas de doublon", () => expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length));
  it("reconnaît les codes valides", () => {
    expect(isPermission("sales.create")).toBe(true);
    expect(isPermission("sales.hack")).toBe(false);
  });
});
