# Procédures d'administration (hors application)

Ces scripts sont exécutés **manuellement** par un opérateur autorisé. Ils ne font jamais partie du déploiement automatique.

| Script | Rôle |
|---|---|
| `create-platform-admin.sql` | Promouvoir un compte existant en administrateur de plateforme (MFA exigée ensuite) |

Règles : exécution d'abord en préproduction ; en production, uniquement avec autorisation écrite ; aucun secret dans ces fichiers.
