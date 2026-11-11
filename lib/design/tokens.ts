// Source de vérité TypeScript des jetons de couleur. Doit rester identique à app/globals.css
// (vérifié automatiquement par scripts/verify-pure-logic.mjs).
export const COLOR_TOKENS = {
  "--navy-900": "#0F172A",
  "--primary-700": "#115E59",
  "--primary-600": "#0F766E",
  "--primary-500": "#0EA5A4",
  "--accent-500": "#F59E0B",
  "--background": "#F8FAFC",
  "--surface": "#FFFFFF",
  "--foreground": "#0F172A",
  "--muted-foreground": "#475569",
  "--border": "#E2E8F0",
  "--danger": "#B91C1C",
  "--success": "#15803D",
  "--sidebar-foreground": "#E2E8F0",
} as const;

/** Paires texte/fond qui DOIVENT respecter WCAG AA (4,5:1). */
export const REQUIRED_AA_PAIRS: ReadonlyArray<readonly [fg: string, bg: string, label: string]> = [
  ["--foreground", "--background", "texte sur fond de page"],
  ["--foreground", "--surface", "texte sur carte"],
  ["--muted-foreground", "--background", "texte secondaire sur fond"],
  ["--muted-foreground", "--surface", "texte secondaire sur carte"],
  ["--surface", "--primary-600", "texte blanc sur bouton principal"],
  ["--surface", "--primary-700", "texte blanc sur bouton principal (survol)"],
  ["--primary-600", "--surface", "lien/texte principal sur carte"],
  ["--primary-600", "--background", "lien/texte principal sur fond"],
  ["--navy-900", "--accent-500", "texte navy sur badge orange"],
  ["--navy-900", "--primary-500", "texte navy sur turquoise"],
  ["--surface", "--danger", "texte blanc sur danger"],
  ["--surface", "--success", "texte blanc sur succès"],
  ["--sidebar-foreground", "--navy-900", "texte de la barre latérale"],
];
