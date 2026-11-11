// Règles de slug : DOIVENT rester identiques à la contrainte CHECK de public.stores
// (vérifié par scripts/verify-pure-logic.mjs).
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export const RESERVED_SLUGS: readonly string[] = [
  "admin", "api", "auth", "boutique", "magasin", "superadmin", "q", "www", "app", "static", "_next",
];

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !RESERVED_SLUGS.includes(slug);
}

/** "Boulangerie Chez Awa !" -> "boulangerie-chez-awa" (sans accents, sans caractères spéciaux). */
export function normalizeSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
