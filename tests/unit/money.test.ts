import { describe, expect, it } from "vitest";
import { addMinor, formatMoney, mulQty, parseXof, percentOf } from "@/lib/money";

describe("money", () => {
  it("additionne des entiers", () => expect(addMinor(1500, 250)).toBe(1750));
  it("refuse les flottants", () => expect(() => addMinor(1.5, 2)).toThrow(RangeError));
  it("multiplie par une quantité décimale (kg)", () => {
    expect(mulQty(3500, 0.75)).toBe(2625);
    expect(mulQty(3500, 1.234)).toBe(4319);
  });
  it("calcule un pourcentage arrondi", () => {
    expect(percentOf(1000, 18)).toBe(180);
    expect(percentOf(999, 10)).toBe(100);
  });
  it("parse les saisies XOF", () => {
    expect(parseXof("1 500")).toBe(1500);
    expect(parseXof("12 000 F CFA")).toBe(12000);
    expect(parseXof("12,5")).toBeNull();
    expect(parseXof("abc")).toBeNull();
  });
  it("formate en F CFA sans décimales", () => {
    const s = formatMoney(1500);
    expect(s).toMatch(/1\D?500/);
    expect(s).toMatch(/CFA/);
  });
});
