// Noms de cookie de session de la bibliothèque d'authentification (lot B3 : Better Auth). À CONFIRMER en B3.
// Le middleware ne s'en sert que pour une redirection rapide : la vérification réelle est faite par la base.
export const SESSION_COOKIE_CANDIDATES = ["better-auth.session_token", "__Secure-better-auth.session_token"] as const;
