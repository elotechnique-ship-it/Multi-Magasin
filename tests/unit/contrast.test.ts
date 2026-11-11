import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast, meetsAA } from "@/lib/design/contrast";
import { COLOR_TOKENS, REQUIRED_AA_PAIRS } from "@/lib/design/tokens";

describe("design tokens : WCAG AA", () => {
  for (const [fg, bg, label] of REQUIRED_AA_PAIRS) {
    it(`${label} (${fg} sur ${bg}) ≥ 4,5:1`, () => {
      const f = COLOR_TOKENS[fg as keyof typeof COLOR_TOKENS];
      const b = COLOR_TOKENS[bg as keyof typeof COLOR_TOKENS];
      expect(contrastRatio(f, b)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("documente pourquoi le turquoise clair n'est pas utilisé pour du texte blanc", () => {
    expect(meetsAA("#FFFFFF", "#0EA5A4")).toBe(false);
    expect(meetsAA("#FFFFFF", "#F59E0B")).toBe(false);
  });
});

describe("garde-fou de couleur de boutique", () => {
  it("assombrit une couleur trop claire jusqu'au contraste AA", () => {
    const fixed = ensureContrast("#0EA5A4");
    expect(contrastRatio("#FFFFFF", fixed)).toBeGreaterThanOrEqual(4.5);
  });
  it("conserve une couleur déjà conforme", () => expect(ensureContrast("#0F766E")).toBe("#0F766E"));
});
