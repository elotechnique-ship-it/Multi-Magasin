// Arithmétique monétaire en ENTIERS (unités mineures). Le XOF n'a pas de décimales : 1 F CFA = 1 unité.
// Aucune opération monétaire ne doit utiliser de nombres flottants non arrondis.

export function assertMinor(value: number, label = "montant"): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} doit être un entier d'unités mineures (reçu : ${value})`);
  }
}

export function addMinor(a: number, b: number): number {
  assertMinor(a);
  assertMinor(b);
  return a + b;
}

export function subMinor(a: number, b: number): number {
  assertMinor(a);
  assertMinor(b);
  return a - b;
}

/** Arrondi commercial (moitié éloignée de zéro) sur un entier. */
function roundHalfAway(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Prix unitaire × quantité (jusqu'à 3 décimales, ex. kg). Résultat arrondi à l'unité mineure. */
export function mulQty(unitMinor: number, qty: number): number {
  assertMinor(unitMinor, "prix unitaire");
  if (!Number.isFinite(qty)) throw new RangeError("quantité invalide");
  const milli = roundHalfAway(qty * 1000); // quantité en millièmes (entier)
  return roundHalfAway((unitMinor * milli) / 1000);
}

/** Pourcentage d'un montant (ex. remise, TVA), arrondi à l'unité mineure. */
export function percentOf(minor: number, percent: number): number {
  assertMinor(minor);
  if (!Number.isFinite(percent)) throw new RangeError("pourcentage invalide");
  return roundHalfAway((minor * percent) / 100);
}

/** Saisie utilisateur -> entier. Accepte espaces, espaces insécables et "F CFA". Refuse les décimales pour le XOF. */
export function parseXof(input: string): number | null {
  const cleaned = input.replace(/[\s\u00A0\u202F]/g, "").replace(/(f?cfa|xof|f)$/i, "");
  if (!/^-?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatMoney(minor: number, currency = "XOF", locale = "fr-SN"): string {
  assertMinor(minor);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XOF" ? 0 : 2,
  }).format(currency === "XOF" ? minor : minor / 100);
}
