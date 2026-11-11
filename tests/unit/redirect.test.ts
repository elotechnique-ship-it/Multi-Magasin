import { describe, expect, it } from "vitest";
import { sanitizeNext } from "@/lib/security/redirect";

describe("sanitizeNext (open redirect)", () => {
  it("accepte les chemins internes", () => {
    expect(sanitizeNext("/magasin/awa")).toBe("/magasin/awa");
    expect(sanitizeNext("/magasin/awa?x=1#y")).toBe("/magasin/awa?x=1#y");
  });
  it("refuse les URL externes et variantes", () => {
    for (const bad of [
      "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "javascript:alert(1)",
      "data:text/html,x", "ftp://evil.com/x", "/\t/evil.com",
    ]) {
      expect(sanitizeNext(bad)).toBe("/magasin");
    }
  });
  it("les séquences encodées restent des chemins internes inoffensifs", () => {
    // %0d%0a reste encodé (pas d'injection d'en-tête) ; un chemin interne n'est jamais un hôte externe.
    expect(sanitizeNext("/%0d%0aLocation:evil")).toBe("/%0d%0aLocation:evil");
    expect(sanitizeNext("/%2f%2fevil.com")).toBe("/%2f%2fevil.com");
  });
  it("utilise la valeur de repli", () => {
    expect(sanitizeNext(null)).toBe("/magasin");
    expect(sanitizeNext(undefined, "/x")).toBe("/x");
    expect(sanitizeNext("", "/x")).toBe("/x");
  });
});
