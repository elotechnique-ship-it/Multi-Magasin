# Commerce SaaS : plateforme de gestion commerciale multi-magasins

**Direction retenue : option B (Railway seul, PostgreSQL, sans Supabase).**
Avancement : B0 terminé ; **B1 (base) et B2 (couche d'accès aux données) livrés, non validés** ; aucune connexion possible avant B3. **Ne pas déployer en production dans cet état.**

| Document | Contenu |
|---|---|
| `docs/option-b-plan.md` | Plan des lots B0 à B6 |
| `docs/b0-decision-note.md` | Décisions techniques (Better Auth, identité vérifiée par la base, rôles) |
| `docs/b1-report.md` | Lot B1 (base de données) : livré, vérifié, non vérifié |
| `docs/b2-report.md` | Lot B2 (couche d'accès) : livré, vérifié, non vérifié, procédure de validation |
| `docs/00-decisions.md` | Journal des décisions et portes de contrôle |

## Prérequis
- **Node.js ≥ 22.18** (vérifier : `node -v`).
- **Docker Desktop**, démarré (icône verte). Le client `psql` n'est **pas** nécessaire : il est utilisé dans le conteneur si absent.

## Valider le lot B1 (porte 1), sous Windows PowerShell

**Important : toutes les commandes `npm` se lancent DANS le dossier du projet** (celui qui contient `package.json`), jamais depuis `C:\Windows\system32`.

```powershell
# 1. Décompresser commerce-saas-option-b-B1.zip, par exemple dans C:\Projets, puis :
cd C:\Projets\commerce-saas
dir package.json                  # doit afficher le fichier ; sinon vous n'êtes pas au bon endroit
node -v                           # v22.18 ou plus

# 2. Dépendances et contrôles sans base
npm install
npm run doctor                    # vérifie dossier, version du code, Node, Docker : corrigez tout ✗ avant de continuer
npm run check:static              # attendu : 6 lignes OK et « 73/73 tests réussis »

# 3. Base locale jetable (Docker Desktop doit être démarré) puis tests de sécurité de la base
node scripts/db/local.mjs up
npm run db:test                   # attendu : « db:test : OK — 100 assertions »
npm run test:integration          # attendu : 9 tests réussis (couche d'accès, base réelle)
npm run typecheck                 # types réels
npm run build                     # premier vrai build
```

Envoyer la sortie **complète** de `db:test` (réussie ou non). Ces commandes n'agissent que sur la base locale `127.0.0.1:5433`.

## Règles de protection
- Aucune donnée supprimée ; **aucune réinitialisation d'une base distante** (l'exécuteur de migrations n'offre ni retour arrière ni reset ; `db:local` n'agit que sur la base locale jetable).
- Aucune politique de sécurité désactivée ; aucune modification de la production sans autorisation écrite.
- Aucun secret dans le dépôt. Le rôle `app_migrator` n'est **jamais** configuré sur le service applicatif.

## Structure
- `db/bootstrap/roles.sql` : création des rôles (mots de passe fournis à l'exécution).
- `db/migrations/` : schéma versionné, **avant seulement**. `db/tests/` : tests pgTAP.
- `scripts/db/` : exécuteur de migrations, lanceur pgTAP, aide locale. `scripts/` : contrôles statiques.
- `legacy` : l'option A (Supabase) est conservée dans la branche `option-a` (étiquette `option-a-final`).
