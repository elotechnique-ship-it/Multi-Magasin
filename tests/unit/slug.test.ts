import { describe, expect, it } from "vitest";
import { isValidSlug, normalizeSlug } from "@/lib/validation/slug";

describe("slug", () => {
  it("normalise un nom de boutique", () => {
    expect(normalizeSlug("Boulangerie Chez Awa !")).toBe("boulangerie-chez-awa");
    expect(normalizeSlug("  Épicerie  Fatou & Fils ")).toBe("epicerie-fatou-fils");
  });
  it("valide les slugs conformes", () => {
    expect(isValidSlug("boutique-awa")).toBe(true);
    expect(isValidSlug("a1")).toBe(false); // trop court (3 caractères minimum)
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("Abc")).toBe(false);
  });
  it("refuse les slugs réservés (collisions de routes)", () => {
    for (const s of ["admin", "api", "auth", "superadmin", "magasin", "boutique"]) expect(isValidSlug(s)).toBe(false);
  });
});
