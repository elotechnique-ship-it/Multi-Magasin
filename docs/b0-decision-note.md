# Lot B0 : note de décision

**Date :** 11 novembre 2026
**Nature de la vérification :** lecture de la documentation officielle actuelle. **Aucune bibliothèque n'a pu être exécutée** (environnement sans réseau). Chaque point ci-dessous est donc « confirmé par la documentation », jamais « démontré ». La preuve par exécution est reportée à la porte 2 (lot B3).

## 1. Décisions

| # | Décision | Résultat |
|---|---|---|
| DB1 | Identité dans la base | **B-2 confirmée** : la base retrouve l'utilisateur et son niveau MFA depuis la table des sessions |
| DB2 | Authentification | **Better Auth retenue** ; l'authentification maison n'est plus nécessaire |
| DB3 | Exécuteur de migrations | Minimal maison (`scripts/db/migrate.mjs`) |
| DB4 | Sauvegardes | `pg_dump` toutes les 6 h + instantanés Railway (lot B5) |
| DB7 | PostgreSQL ≥ 15 | Exigé ; image locale et CI en PostgreSQL 16 ; **à vérifier sur Railway à la création de la base** |
| DB8 | Environnement local | Docker Compose + PostgreSQL 16 avec pgTAP |
| DB9 | Branche `option-a` | Créée (Git), étiquette `option-a-final` |
| **DB10** | **Trois accès séparés à la base** (ajout issu du B0) | `app_auth` (réservé à la bibliothèque d'authentification, schéma `auth` uniquement), `app_runtime` (données métier, sous RLS, **aucun accès à `auth`**), `app_public` (boutique publique, fonctions en liste blanche). Un compromis des requêtes métier ne donne donc pas accès aux hachages de mots de passe |

## 2. Constats du B0

### 2.1 Better Auth convient, et Auth.js n'est plus une alternative distincte
- Better Auth accepte directement un `pg.Pool`, et propose des identifiants **UUID** (`advanced.database.generateId`).
- Le projet Auth.js fait désormais partie de Better Auth : la comparaison à deux options n'a plus de sens.
- Le plugin de double authentification gère TOTP, codes de secours et OTP.

### 2.2 La double authentification est compatible avec la variante B-2
Selon la documentation, lorsqu'un utilisateur ayant activé la 2FA se connecte avec ses identifiants, **aucune session n'est créée** tant que le second facteur n'est pas vérifié. Le drapeau `twoFactorEnabled` n'est activé qu'après la première vérification TOTP réussie.

Conséquence retenue pour la base : **niveau `aal2` = session valide ET `twoFactorEnabled` vrai**. Un administrateur de plateforme sans 2FA active n'a donc aucun droit de plateforme, même connecté (c'est l'équivalent de la règle actuelle).

### 2.3 Points qui devront être prouvés par exécution (porte 2)
| Risque | Exigence |
|---|---|
| **Appareils de confiance** : la fonction permet de sauter la 2FA pendant 30 jours | Doit être **désactivée** ; test : un paramètre `trustDevice` envoyé par un client est refusé ou ignoré |
| Méthodes de connexion hors identifiants (lien magique, OAuth, etc.) ne sont pas soumises à la 2FA par défaut | **Aucune** de ces méthodes n'est activée ; inscription publique désactivée ; test que ces routes répondent 404 |
| Réinitialisation de mot de passe | Test : elle ne crée pas de session sans 2FA |
| Schéma exact des tables (`user`, `session`, `account`, `verification`, `twoFactor`, `rateLimit`) | La migration `auth` est écrite d'après la documentation ; **à comparer avec la sortie de la commande de génération de schéma de Better Auth** à la première installation (critère de sortie du B1, à votre charge) |
| Le jeton de session est stocké en clair dans la table `session` | Une fuite de la base (ou d'une sauvegarde) exposerait des sessions actives : sessions courtes, sauvegardes **chiffrées**, révocation en cas d'incident |

## 3. Choix de conception pour le schéma d'authentification
- Tables dans un schéma dédié `auth`, avec les noms et colonnes **par défaut de Better Auth** (noms en camelCase entre guillemets) : aucune configuration de correspondance de colonnes, donc moins de risque.
- La connexion `app_auth` fixe `search_path = auth` : les noms de tables non qualifiés de la bibliothèque s'y résolvent.
- Les tables d'authentification ont la RLS activée et forcée avec **une seule politique, réservée à `app_auth`**.
- Les clés étrangères de nos tables vers les comptes pointent vers `auth."user"(id)`.

## 4. Conséquences
- Le plan `option-b-plan.md` est confirmé ; la variante **B-2** est implémentée au lot B1.
- Nouveau rôle de base `app_migrator` : propriétaire des objets, **`BYPASSRLS`**, utilisé uniquement par l'exécuteur de migrations. Il n'est **jamais** configuré sur le service applicatif.
- Les identifiants des rôles ne figurent **jamais** dans les migrations : ils sont créés par un script d'amorçage (`db/bootstrap/roles.sql`) exécuté une fois par l'opérateur, mots de passe fournis à l'exécution.
