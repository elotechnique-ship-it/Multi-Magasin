// Dictionnaire français centralisé (migration vers next-intl prévue quand une 2e langue sera requise).
export const fr = {
  appName: "Commerce",
  auth: {
    loginTitle: "Connexion",
    email: "Adresse e-mail",
    password: "Mot de passe",
    submit: "Se connecter",
    invalid: "Adresse e-mail ou mot de passe incorrect.",
    forgot: "Mot de passe oublié ?",
    forgotTitle: "Réinitialiser le mot de passe",
    forgotSent: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",
    resetTitle: "Nouveau mot de passe",
    logout: "Se déconnecter",
  },
  shell: {
    soon: "Bientôt",
    readOnly: "Abonnement à régulariser : votre magasin est en lecture seule. Vos données sont conservées.",
    blocked: "Magasin suspendu. Contactez le support.",
    search: "Rechercher (bientôt)",
  },
  empty: { title: "Rien à afficher pour le moment", description: "Les données apparaîtront ici dès leur création." },
  error: { title: "Une erreur est survenue", retry: "Réessayer" },
  notFound: { title: "Page introuvable", description: "Cette page n'existe pas ou vous n'y avez pas accès.", home: "Retour à l'accueil" },
} as const;
