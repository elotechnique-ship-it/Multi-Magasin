# Rapport du lot B1 : base de données (option B)

**Date :** 11 novembre 2026
**Statut : LIVRÉ, NON VALIDÉ.** Le code est écrit et les contrôles exécutables ici ont réussi. **Les migrations n'ont jamais été appliquées sur PostgreSQL et les 90 assertions pgTAP n'ont jamais tourné**, faute de PostgreSQL, de Docker et d'accès réseau dans mon environnement. Le lot B2 ne démarre pas avant la porte 1 (Gate G).

## 1. Livré

| Élément | Détail |
|---|---|
| Rôles | `db/bootstrap/roles.sql` : `app_migrator` (BYPASSRLS), `app_auth`, `app_runtime`, `app_public`. Aucun mot de passe dans le dépôt (fournis à l'exécution) |
| Migrations (9) | 100 fondations · 150 schéma `auth` (6 tables) · 200 plateforme · 300 magasins · 400 identité · 500 audit · 600 fonctions et RPC · 700 RLS et privilèges · 800 référentiels. **29 tables, toutes en RLS activée + forcée** |
| Identité vérifiée par la base (B-2) | `private.current_user_id()` et `private.current_aal()` retrouvent l'utilisateur et le niveau 2FA dans `auth.session`. Sans session valide : aucun droit |
| Isolation du schéma `auth` | Hachages de mots de passe, sessions et secrets TOTP accessibles à `app_auth` seulement ; `app_runtime` et `app_public` n'ont aucun accès, pas même en lecture du schéma |
| Exécuteur de migrations | `scripts/db/migrate.mjs` : avant seulement, somme de contrôle, verrou, une transaction par migration, garde-fous de cible, aucune option de retour arrière ni de réinitialisation, production soumise à confirmation explicite |
| Tests | pgTAP : 22 assertions (socle) + 68 (isolation, sessions, 2FA, invitations, journaux). Tests unitaires : 21 nouveaux (planification, garde-fous, analyse TAP) |
| Outillage | `docker-compose.yml` + `db/Dockerfile` (PostgreSQL 16 + pgTAP), `scripts/db/local.mjs`, job CI « base de données » |
| Contrôles statiques | Règles R1 à R10 (nouvelles : droits sur `auth` réservés à `app_auth`, aucun rôle ni mot de passe dans une migration, aucun droit à `app_public` sans marqueur) |
| Git | Branche `option-a` + étiquette `option-a-final` (option A intacte) ; travail sur `option-b` |

## 2. Vérifications EXÉCUTÉES (résultats réels)

| Contrôle | Résultat |
|---|---|
| `check-migrations` R1 à R10 | OK : 9 migrations, 29 tables |
| Tests de mutation des règles | 8 violations injectées (table `auth` sans RLS, droit sur `auth` à `app_runtime`, droit à `app_public`, création de rôle avec mot de passe, `DROP TABLE`, retrait de `FORCE RLS`, code applicatif citant le rôle migrateur, URL avec mot de passe) : **toutes détectées**, état propre restauré |
| `check-permission-drift` | OK : 39 permissions identiques TypeScript/SQL |
| `check-secrets` | OK : 113 fichiers |
| Tests unitaires | **56/56** exécutés par mon harnais (pas par Vitest) |
| Exécuteur de migrations, garde-fous | Vérifiés par exécution : cible absente, `--reset` refusé, URL absente, rôle ≠ `app_migrator` refusé, production sur hôte local refusée, production sans confirmation refusée, validation hors ligne des 9 migrations OK |
| Lanceur pgTAP, garde-fous | Vérifiés : hôte distant refusé, base sans « test » refusée |

## 3. NON exécuté : à prouver par vous (porte 1)

| Non vérifié | Pourquoi c'est important |
|---|---|
| **Application des 9 migrations sur PostgreSQL 16** | Une erreur de syntaxe ou d'ordre n'a jamais été vue par un vrai serveur |
| **90 assertions pgTAP** | La preuve d'isolation entre magasins n'existe pas tant qu'elles n'ont pas tourné. Points fragiles : syntaxe `psql` de l'amorçage (`\gexec`, variables), `has_function_privilege('public', …)`, comptage du plan (`no_plan`) |
| **Schéma `auth` vs Better Auth** | Écrit d'après la documentation. À comparer à la sortie de la commande de génération de schéma de Better Auth (colonnes, types, tables du plugin 2FA). **Critère de sortie du B1** |
| Exécuteur de migrations contre une vraie base | Seules les parties sans base ont été exécutées (la connexion, le verrou, les transactions ne l'ont pas été) |
| Image Docker `postgres:16` + paquet `postgresql-16-pgtap` | Nom de paquet non vérifié |
| Workflow CI | Jamais exécuté |

## 4. Procédure de validation (porte 1)

Prérequis : Docker Desktop (démarré), Node ≥ 22.18. Le client `psql` est facultatif (repli sur le conteneur).

```bash
git checkout option-b
npm install                       # génère package-lock.json : à commiter
npm run check:static              # doit passer
node scripts/db/local.mjs up      # PostgreSQL 16 + pgTAP, jetable
npm run db:test                   # crée commerce_test, amorce les rôles, migre, lance pgTAP
```

Résultat attendu : `db:test : OK — 90 assertions`. Envoyez-moi la sortie **complète** (réussie ou non). Pour le schéma Better Auth : installez la bibliothèque, lancez sa commande de génération de schéma et envoyez-moi le SQL produit ; je le compare à la migration 150.

Aucune commande ci-dessus ne touche une base distante ; `db:local` n'agit que sur `127.0.0.1:5433`.

## 5. Points d'attention

1. **`BYPASSRLS` du migrateur** : nécessaire parce que les tables sont en RLS forcée et que les fonctions d'aide `SECURITY DEFINER` lisent `store_members` sous l'identité du propriétaire. Ce rôle ne doit **jamais** être configuré sur le service applicatif (règle de contrôle de secrets en place).
2. **Jetons de session en clair dans `auth.session`** (comportement de la bibliothèque) : sessions courtes, sauvegardes chiffrées. Voir `b0-decision-note.md` §2.3.
3. **`aal2` = session valide + 2FA activée** repose sur le fait que Better Auth ne crée pas de session avant le second facteur et que les « appareils de confiance » sont désactivés : **à prouver en B3**.
4. **Le jeton de session circule dans une variable de transaction** : ne jamais activer la journalisation des paramètres de requêtes en production.
5. Les journaux (`audit_logs`, etc.) restent en ajout seul, y compris pour le propriétaire des tables.

## 6. Corrections ultérieures (11-12 nov. 2026)
- `local.mjs` : la création de la base de test utilisait `\gexec` dans `psql -c`, ce que psql interdit ; corrigé (entrée standard). Ce défaut aurait fait échouer `db:test` et la CI.
- Trois scripts construisaient des chemins avec `.pathname` (incorrect sous Windows) ; corrigé, séparateurs normalisés.
- Sommes de contrôle des migrations calculées sur des fins de ligne normalisées (CRLF/LF) ; `.gitattributes` ajouté.
- Repli sur `psql` dans le conteneur Docker si le client n'est pas installé.

## 7. Écarts et limites
- Le lot B1 ne touche **pas** l'application : elle utilise toujours le code Supabase (`lib/supabase/*`), qui ne fonctionne plus avec ces migrations. C'est le périmètre du lot B2. **L'état actuel de la branche n'est donc pas déployable.**
- Aucune sauvegarde ni aucun déploiement n'est configuré (lot B5).
- Les documents `security.md`, `database.md` et `architecture.md` portent une bannière de caducité partielle ; leur réécriture est au lot B6.
