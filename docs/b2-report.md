# Rapport du lot B2 : couche d'accès aux données

**Date :** 12 novembre 2026
**Statut : LIVRÉ, NON VALIDÉ.** Comme pour B1, ni PostgreSQL, ni Docker, ni `npm install` n'étaient disponibles dans mon environnement : **les tests d'intégration, les 100 assertions pgTAP, le build et l'application elle-même n'ont jamais été exécutés.** La porte 1 (Gate G) reste ouverte.

## 1. Ce que fait le lot B2
Il supprime toute dépendance à Supabase dans le code applicatif et impose que **chaque requête métier passe par une seule fonction**, `withSession()`, qui ouvre une transaction, fixe le jeton de session, exécute les requêtes sous RLS puis valide ou annule. La base retrouve elle-même l'utilisateur dans `auth.session` (variante B-2).

**L'application n'est pas utilisable de bout en bout :** aucune session ne peut être créée avant le lot B3 (authentification). `getCurrentSessionToken()` renvoie volontairement `null`, donc toute page protégée redirige vers la connexion, qui affiche « disponible au lot B3 ». C'est le comportement attendu, pas un défaut.

## 2. Livré

| Élément | Détail |
|---|---|
| `lib/db/session-tx.ts` | Transaction sous session (logique pure) : jeton passé **en paramètre** (jamais concaténé), lecture seule possible, rollback sur erreur, connexion détruite si le rollback échoue, aucune sortie de la transaction possible pour l'appelant |
| `lib/db/pool.ts`, `with-session.ts` | Pool unique (rôle `app_runtime`), délais d'attente, réservé à `lib/db` |
| `lib/db/runtime-url.ts` | **Garde-fou** : l'application **refuse de démarrer** si `DATABASE_URL` n'utilise pas le rôle `app_runtime` (protège du piège de la variable Railway qui contient le superutilisateur) |
| `lib/db/queries/*` | Requêtes paramétrées : magasins, permissions, modules, identité, invitation |
| Migration 900 | `public.my_identity()` : l'application lit l'identité de la session **sans accès au schéma `auth`** |
| Gardes et pages | `requireIdentity`, `requirePlatformAdmin`, `requireStoreAccess` (une seule transaction), sélecteur de magasin, layouts : réécrits sans Supabase |
| Acceptation d'invitation | **Réelle dès B2** (la base vérifie jeton, e-mail du compte connecté, expiration, usage unique) |
| Middleware | Redirection rapide sur présence de cookie. **Ce n'est pas un contrôle d'accès** (documenté dans le fichier) |
| Supprimé | `lib/supabase/*`, callback d'authentification, formulaire MFA Supabase, variables `SUPABASE_*`, dépendances `@supabase/*` |
| Tests | 73 tests unitaires ; 9 tests d'intégration (base réelle) ; pgTAP : 100 assertions (nouveau fichier 003 : 10) |
| Contrôle statique `check-db-access` | Règles D1 à D6 (voir §3) |

## 3. Garanties vérifiées automatiquement (par `check:static`)

| Règle | Interdit |
|---|---|
| D1 | Importer le pilote `pg` hors de `lib/db/pool.ts` |
| D2 | Importer le pool hors de `with-session.ts` (donc : aucune requête hors transaction de session) |
| D3 | Créer un pool ailleurs |
| D4 | Référencer une table du schéma `auth` depuis l'application |
| D5 | Interpoler une valeur dans un gabarit SQL (injection) |
| D6 | Fixer `app.session_token` ailleurs que dans `session-tx.ts` |
| (secrets) | Importer la couche base depuis un composant client ; référencer `DATABASE_URL` hors de `lib/env.server.ts` ; référencer le rôle migrateur dans le code applicatif |

## 4. Vérifications EXÉCUTÉES (résultats réels)

| Contrôle | Résultat |
|---|---|
| `check-migrations` R1 à R10 | OK : 10 migrations, 29 tables |
| `check-permission-drift` | OK : 39 permissions |
| `check-secrets` | OK : 124 fichiers |
| `check-db-access` D1 à D6 | OK |
| **Tests de mutation** | 6 contournements injectés (pg + Pool hors couche, pool hors `with-session`, requête sur `auth`, jeton fixé ailleurs, **SQL concaténé**, composant client important la couche base) : **tous détectés** ; état propre restauré |
| Tests unitaires | **73/73** (harnais maison, pas Vitest) : transaction de session avec fausse connexion (ordre begin / set_config / commit, rollback, destruction de connexion, jeton jamais dans le SQL), garde-fou d'URL (superutilisateur refusé, mot de passe jamais dans l'erreur), requêtes paramétrées avec tentative d'injection |
| `tsc --strict` | 0 erreur, avec **types simulés** pour React, Next, `pg`, Vitest ; vrais types pour `zod`, `clsx`, `@types/node` |
| Exécuteur de migrations (hors ligne) | Les 10 migrations sont validées |

Deux défauts trouvés et corrigés pendant ce lot : (1) mes scripts d'administration interrogeaient encore `auth.users` (table inexistante) ; (2) une règle de secrets trop large qui signalait des fichiers légitimes de la couche d'accès (autorisés précisément, sans affaiblir la règle ailleurs).

## 5. NON exécuté : à prouver (porte 1)

| Non vérifié | Risque |
|---|---|
| Les 10 migrations sur PostgreSQL 16 | Erreur de syntaxe ou d'ordre |
| 100 assertions pgTAP | La preuve d'isolation entre magasins n'existe pas tant qu'elles n'ont pas tourné |
| **9 tests d'intégration** (couche d'accès contre une vraie base) | Incluent : isolation, session expirée/falsifiée, **absence de fuite du jeton entre transactions** (pool d'une connexion), lecture seule, refus d'accès à `auth`, invitation |
| `npm install` et `next build` | Aucun vrai build n'a jamais eu lieu ; erreurs d'API de bibliothèque possibles |
| Compatibilité des types réels de `pg` avec ma façade `TxClient` | Je n'ai que des déclarations simulées |
| Image Docker, CI | Jamais exécutées |

## 6. Procédure de validation

```powershell
cd C:\Projets\commerce-saas
git pull            # ou télécharger à nouveau le zip
npm install
npm run check:static                 # attendu : 6 lignes OK et « 73/73 tests réussis »
node scripts/db/local.mjs up         # Docker Desktop démarré
npm run db:test                      # attendu : « OK — 100 assertions »
npm run test:integration             # attendu : 9 tests réussis
npm run typecheck                    # types réels
npm run build                        # premier vrai build
```
Envoyez-moi la sortie de **chaque** commande, même en cas d'échec.

## 7. Points d'attention
1. **Jeton de session dans une variable de transaction** : ne jamais activer la journalisation des paramètres de requêtes en production.
2. **Pool et `idle_in_transaction_session_timeout`** (15 s) : une page qui reste ouverte dans une transaction trop longtemps verrait sa connexion coupée ; les transactions sont courtes par conception (lecture seule, une par page).
3. **Aucun contrôle d'accès dans le middleware** : si un cookie est présent mais invalide, la redirection est faite par les layouts serveur, via la base.
4. **Mode dégradé volontaire** : tant que B3 n'existe pas, l'application ne peut ouvrir aucune session. Ne pas la déployer en production dans cet état (elle fonctionnerait comme un site vitrine sans connexion).

## 8. Premier essai sur une machine réelle (12 nov. 2026, Windows, Node 26)

Résultats du maître d'ouvrage, obtenus sur une **ancienne version** du code (9 migrations, 57 tests, Supabase encore présent).

| Constat | Interprétation |
|---|---|
| `npm install` : 432 paquets ; 15 vulnérabilités signalées (2 critiques, 3 élevées) | À analyser avec `npm audit --omit=dev` (la plupart des alertes viennent d'outils de développement). **Ne pas lancer `npm audit fix --force`** |
| `check:static` réussi sous Windows | Première preuve réelle : les corrections de chemins Windows fonctionnent |
| `next build` : « Compiled successfully » | Première compilation réelle du code par Next.js |
| ESLint : « Failed to load config next/core-web-vitals … Referenced from D:\Projet\Multi-Magasin\.eslintrc.json » | Un `.eslintrc.json` d'un dossier **parent** (copies imbriquées) était chargé. Corrigé par `"root": true` ; `npm run doctor` détecte ce cas |
| Erreurs de types dans `lib/supabase/server.ts` et `middleware.ts` | Ancien code Supabase, supprimé par B2 |
| Docker : moteur injoignable | Docker Desktop non démarré ; `npm run doctor` le détecte |
| Commandes lancées depuis `...\lib` | `node scripts/...` exige la racine du projet ; `npm run doctor` avertit |

Avertissements Node 26 (`module.register()` déprécié, type de module non précisé) : sans conséquence pour l'instant. Dette technique : migrer vers `module.registerHooks()`.
