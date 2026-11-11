// Contraste WCAG 2.x. Utilisé pour valider les jetons de design et pour le garde-fou
// de personnalisation des boutiques (couleur principale choisie par le commerçant).

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`couleur invalide : ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAA(fg: string, bg: string, largeText = false): boolean {
  return contrastRatio(fg, bg) >= (largeText ? 3 : 4.5);
}

/**
 * Garde-fou boutique : assombrit la couleur jusqu'à obtenir le contraste minimal contre le fond
 * (par défaut texte blanc sur la couleur choisie). Retourne la couleur d'origine si elle convient déjà.
 */
export function ensureContrast(color: string, against = "#FFFFFF", min = 4.5): string {
  let [r, g, b] = hexToRgb(color);
  let current = rgbToHex(r, g, b);
  for (let i = 0; i < 100 && contrastRatio(current, against) < min; i++) {
    r *= 0.95;
    g *= 0.95;
    b *= 0.95;
    current = rgbToHex(r, g, b);
  }
  return current;
}
