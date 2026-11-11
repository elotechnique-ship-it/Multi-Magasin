# Rapport de Phase 1 : Fondations

> **Rapport relatif à l'option A (Supabase).** L'option B (décision du 11 nov. 2026) impose une revalidation (« Phase 1B ») : voir `option-b-plan.md`. Ce rapport reste valable pour la partie interface, design system et contrôles statiques.


**Date :** 11 novembre 2026
**Statut : LIVRÉE, NON VALIDÉE.** Le code est écrit et a passé tous les contrôles exécutables dans l'environnement de développement de cette session. Les contrôles qui exigent PostgreSQL, `npm install` ou un navigateur **n'ont pas pu être exécutés**. Conformément à la règle « ne pas passer à la phase suivante sans avoir terminé et testé », **la Phase 2 ne démarre pas** tant que la procédure de validation (README) n'a pas réussi sur une machine disposant de Docker et d'un accès réseau.

## 1. Environnement d'exécution de cette session

| Disponible | Indisponible |
|---|---|
| Node 22 (exécution native de TypeScript), TypeScript 6.0.3, `zod`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@types/node` | **PostgreSQL**, Docker, Supabase CLI, **accès réseau** (`npm install` impossible), React/Next/Supabase SDK/lucide/Vitest/Playwright |

## 2. Périmètre livré

| Lot | Contenu | Fichiers clés |
|---|---|---|
| 1.1 Dépôt, CI | Configuration Next.js/TypeScript/Tailwind/ESLint/Vitest/Playwright, workflow CI en 4 jobs, `.env.example` (noms seuls), en-têtes de sécurité | `package.json`, `next.config.ts`, `.github/workflows/ci.yml` |
| 1.2 Migrations noyau | 8 migrations additives : 23 tables, enums, triggers, référentiels (39 permissions, 8 rôles système, 12 catégories, 23 modules, 4 plans fictifs inactifs) | `supabase/migrations/*` (914 lignes) |
| 1.3 Authentification | Connexion, déconnexion, mot de passe oublié/réinitialisation, callback, acceptation d'invitation, MFA TOTP (enrôlement + vérification), middleware de session, gardes serveur | `app/auth/*`, `lib/auth/*`, `middleware.ts` |
| 1.4 RLS et tests | RLS **activée et forcée** sur 23 tables, 47 politiques, privilèges par colonne, 11 + 55 assertions pgTAP | `supabase/migrations/…0700_*`, `supabase/tests/*` |
| 1.5 Design system et shell | Jetons AA, 8 composants de base, AppShell responsive, registre de modules, états vide/erreur/404, dictionnaire français | `app/globals.css`, `components/*`, `lib/modules/*` |
| Contrôles statiques | 5 scripts exécutables sans dépendances, aussi lancés en CI | `scripts/*.mjs` |

## 3. Vérifications EXÉCUTÉES (résultats réels)

| Contrôle | Résultat |
|---|---|
| `check-migrations` (R1 à R8) | OK : 8 migrations, 23 tables avec RLS activée + forcée, aucune opération destructive, tout `SECURITY DEFINER` fixe `search_path`, aucun `GRANT` à `anon` |
| `check-permission-drift` | OK : 39 permissions identiques en TypeScript et SQL ; toutes les références (rôles, politiques, menu) valides |
| `check-secrets` | OK : 86 fichiers, aucun secret, aucun composant client important un module serveur |
| `verify-pure-logic` | OK : jetons CSS = TypeScript ; regex et liste réservée des slugs = contrainte SQL ; 19 variables CSS résolues |
| Contrastes WCAG AA | 13 paires toutes ≥ 5,02:1 (minimum requis 4,5:1). Le turquoise clair `#0EA5A4` et l'orange `#F59E0B` avec du **texte blanc** échouent bien (confirmé par test) |
| Tests unitaires purs | 35/35 exécutions réussies (argent, contraste, slugs, redirections, menu, permissions). **Exécutés par un harnais maison (`run-unit-tests.mjs`) et non par Vitest** : mêmes fichiers de test, API simulée |
| `tsc --strict` | 0 erreur sur l'ensemble du projet, avec les **vrais types** de zod, clsx, tailwind-merge, cva, @types/node et des **déclarations simulées** pour React, Next, Supabase, lucide, Vitest, Playwright |
| **Tests de mutation** des contrôles | Les violations injectées volontairement (table sans RLS, `DROP`, `SECURITY DEFINER` sans `search_path`, `GRANT` à `anon`, désactivation de RLS, import client du service role, dérive de permissions, dérive de couleur) sont **toutes détectées** (exit 1) ; l'état propre a été restauré et revérifié |

Deux erreurs de ma part, détectées et corrigées pendant la session : règle de secrets trop stricte (fichier `admin.ts` légitime) ; attentes erronées dans le test de redirection ouverte.

## 4. Vérifications NON EXÉCUTÉES

| Non vérifié | Risque associé |
|---|---|
| **Aucune migration n'a été exécutée sur PostgreSQL.** Seules des vérifications statiques (nom, parenthèses, délimiteurs, règles de sécurité) ont été faites | Une erreur de syntaxe ou d'ordre SQL est possible |
| **Les 66 assertions pgTAP n'ont jamais tourné.** Points à risque connus : insertion directe dans `auth.users`, changement de rôle sous pgTAP, `throws_ok` avec message `NULL` | Un test peut échouer pour une raison de mise en œuvre et non de sécurité (ou, inversement, masquer un défaut) |
| `npm install` : **les versions ne sont pas figées** (pas de `package-lock.json`) | Critère « versions figées » de la Phase 1 non atteint |
| `next build`, `next lint`, Vitest réel, Playwright | Erreurs de compilation, d'API de bibliothèque ou de lint possibles |
| Signatures réelles du SDK Supabase (auth, MFA, `rpc`) et noms d'icônes `lucide-react` (`BarChart3`, `UserCog`…) | Erreurs au premier build ; correctifs simples |
| `supabase/config.toml` | Clés dépendantes de la version du CLI ; peut être rejeté au démarrage |
| Parcours réels : connexion, MFA, invitation, réinitialisation | Aucun test de bout en bout n'a pu être exécuté |
| Revue visuelle, axe, Lighthouse, responsive | Aucune validation d'interface faite |
| Workflow CI, gitleaks | Jamais exécutés |

## 5. Écarts par rapport au plan de la Phase 1

| Écart | Décision |
|---|---|
| Composants différés : DataTable, Modal/Drawer, Toast, ConfirmDialog, MoneyInput, Breadcrumbs, palette de recherche | Reportés à la Phase 2, où ils servent pour la première fois (évite du code non exercé) |
| i18n | Dictionnaire `lib/i18n/fr.ts` à la place de `next-intl` ; migration prévue quand une 2e langue sera requise |
| Polices | Pile système (Inter/Plus Jakarta citées mais non embarquées) ; auto-hébergement à faire |
| CSP | En mode **Report-Only** (jamais enforcée sans mesure des violations) ; durcissement avec nonces en Phase 9 |
| **Protection anti-force-brute (plan 1.3)** | **Incomplète** : réponses génériques et limites natives de Supabase uniquement. Non faits : CAPTCHA, verrouillage progressif, écriture dans `login_events`. À traiter dès le début de la Phase 2 |
| Création de comptes par invitation | L'**acceptation** est livrée ; la **création** d'invitation (et du compte Auth) arrive avec `create_store` en Phase 2. Le parcours complet ne peut donc pas encore être joué de bout en bout |
| Permissions ajoutées à la matrice (cases « limité ») | `sales.discount_limited`, `purchases.receive`, `suppliers.view` |
| `store_modules` | Écriture réservée au propriétaire de la plateforme (les modules suivent le plan, pas la volonté du commerçant) |

## 6. Points d'attention pour l'exécution réelle

1. **Privilèges par défaut globaux** : `alter default privileges revoke execute on functions from public` s'applique aux futures fonctions du rôle de migration dans tous les schémas. Vérifier qu'aucune extension ne s'en trouve affectée au premier `supabase start`. Toute nouvelle fonction doit recevoir un `GRANT EXECUTE` explicite (exigé par le contrôle R6 pour `public`).
2. **`FORCE ROW LEVEL SECURITY`** : les fonctions d'aide `SECURITY DEFINER` s'appuient sur le propriétaire de la fonction (`postgres`, qui contourne la RLS sur Supabase). À confirmer par les tests pgTAP.
3. **Middleware** : `getUser()` à chaque requête protégée valide le jeton auprès du serveur d'authentification (plus sûr que `getSession()`) mais ajoute un appel réseau. Acceptable à 20 magasins ; à mesurer en Phase 9.
4. **TypeScript** : le projet cible `^5.6` ; l'environnement de session avait 6.0.3. Le code type-check sur 6.0.3, ce qui est de bon augure mais ne prouve rien sur 5.x.
5. **Zod** : le projet cible `^3.23` ; la version locale de test pouvait être différente.

## 7. Décisions à prendre avant la Phase 2

| # | Question | Recommandation |
|---|---|---|
| Q1 | Qui exécute la procédure de validation (README §« Procédure ») : vous, ou un environnement de CI que vous me donnez ? | Exécution locale (Docker) ou CI GitHub ; me transmettre les sorties |
| Q2 | Fournisseur d'e-mail transactionnel (invitations, réinitialisations) | À choisir en Phase 2 |
| Q3 | CAPTCHA (Cloudflare Turnstile recommandé) pour la connexion | Oui, au début de la Phase 2 |
| Q4 | Audit de l'existant (Gate A) : exports toujours attendus | Inchangé |

## 8. Critères de sortie de la Phase 1 : état

| Critère | État |
|---|---|
| Tests d'isolation inter-tenant verts | **Non démontré** (écrits, non exécutés) |
| Accès par modification d'URL/ID refusé | Conçu (RLS + 404 générique), **non testé en E2E** |
| Build sans secret | Contrôle statique OK ; **build réel non exécuté** |
| Documentation à jour | Oui |
| Rapport de validation | Ce document |
| Autorisation de passer à la Phase 2 | **Non demandée** : prérequis non satisfaits |
