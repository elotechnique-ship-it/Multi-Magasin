import "server-only";

/**
 * Jeton de la session courante, ou null s'il n'y en a pas.
 *
 * LOT B2 : volontairement vide. L'authentification (connexion, cookies, Better Auth) est le lot B3 ; tant qu'elle
 * n'existe pas, AUCUNE session n'est acceptée et toutes les pages protégées redirigent vers la connexion.
 * Ne jamais lire ici un cookie « à la main » : la signature du cookie de session est vérifiée par la bibliothèque (B3).
 */
export async function getCurrentSessionToken(): Promise<string | null> {
  return null;
}
