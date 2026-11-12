# Option B : Railway seul (sans Supabase) : plan détaillé

**Statut : plan VALIDÉ (« ok », 11 nov. 2026). B0 terminé ; B1 et B2 livrés non validés : voir `b0-decision-note.md`, `b1-report.md`, `b2-report.md`.**
**Décision du maître d'ouvrage :** option B retenue le 11 novembre 2026.

## 1. Principe

L'application Next.js et la base PostgreSQL sont toutes deux hébergées sur Railway. Les fonctions que fournissait Supabase (comptes, sessions, double authentification, e-mails d'authentification, sauvegardes, stockage) sont **remplacées par des composants que nous maîtrisons**. Le modèle de sécurité reste identique : isolation par magasin imposée **dans la base** (RLS), refus par défaut, journaux en ajout seul, SuperAdmin protégé par double authentification.

Ce qui change, c'est **qui prouve l'identité à la base**. Voir §3.

## 2. Ce qui est conservé, adapté, réécrit

Mesuré sur le code livré en Phase 1.

| Catégorie | Éléments |
|---|---|
| **Conservé tel quel** | Interface (composants UI, AppShell), design system et jetons AA, `lib/money`, `lib/design`, `lib/validation`, `lib/security/redirect`, `lib/permissions`, `lib/modules`, `lib/i18n` (17 fichiers), migrations 300 (magasins), 500 (audit) et 800 (référentiels), scripts de contrôle (adaptés à la marge), documents de Phase 0 |
| **Adapté** | Migrations 100 et 200 (rôles, clé étrangère vers les comptes), 400 (profils, invitations), tests pgTAP 001, CI |
| **Réécrit** | Migrations 600 (fonctions d'aide, RPC) et 700 (RLS et privilèges, 60 références Supabase), test pgTAP 002, `lib/supabase/*` (3 fichiers), `lib/auth/*` (3 fichiers), `middleware.ts`, pages `app/auth/*` (callback, MFA, formulaires), `lib/env*`, `railway.json` et la doc de déploiement |
| **Supprimé** | `supabase/config.toml`, dépendances `@supabase/*`, job CI Supabase |

Les copies actuelles (option A) sont **conservées dans l'historique Git** (branche `option-a`) et dans la livraison zip existante : rien n'est détruit.

## 3. Décision de conception majeure : comment la base connaît l'utilisateur

Avec Supabase, le jeton de l'utilisateur est signé et la base lit `auth.uid()` et le niveau `aal2`. Sans Supabase, il faut un équivalent. Deux variantes :

| Variante | Fonctionnement | Avantage | Inconvénient |
|---|---|---|---|
| **B-1. Identité affirmée par l'application** | L'application exécute `set_config('app.user_id', …, true)` au début de chaque transaction | Simple | La base **fait confiance** à l'application : une faille applicative permettrait d'usurper n'importe quel utilisateur |
| **B-2. Identité vérifiée par la base (recommandée)** | L'application transmet seulement l'empreinte du jeton de session ; une fonction de la base la **retrouve dans la table des sessions** (non expirée) et en déduit l'utilisateur et l'état « double authentification validée » | Un code applicatif défaillant ne peut pas inventer une identité sans un jeton valide ; le niveau MFA est lu **dans la base**, pas affirmé | Une lecture de plus par requête (à mesurer) ; dépend de la forme de la table de sessions de la bibliothèque d'authentification |

Dans les deux cas, `auth.uid()` devient `private.current_user_id()` et `auth.jwt()->>'aal'` devient `private.current_aal()`. Les politiques RLS gardent la même forme.

**Rôles PostgreSQL (remplacent `anon` / `authenticated`) :**

| Rôle | Usage | Droits |
|---|---|---|
| `app_migrator` | Propriétaire des objets ; exécute les migrations (CI et opérateur uniquement) | Complets. **Jamais** utilisé par l'application |
| `app_runtime` | Connexion de l'application pour les utilisateurs connectés | Ni propriétaire, ni `BYPASSRLS`, ni création d'objets ; droits table par table et par colonne comme aujourd'hui |
| `app_public` | Connexion séparée pour la boutique publique (Phase 5) | `EXECUTE` uniquement sur les fonctions `shop_*` en liste blanche |

Chaque requête utilisateur s'exécute dans une **transaction** qui commence par fixer la session, ce qui est compatible avec un pool de connexions.

## 4. Lots

Tailles relatives : S petit, M moyen, L grand. Chaque lot a ses critères de sortie ; ils sont **vérifiés par exécution réelle** (voir §6), pas supposés.

### B0 : Cadrage et essai technique (S)
- Comparer **Better Auth** (plugin de double authentification TOTP à confirmer sur la version stable) et une authentification **minimale maison** : identifiants UUID, hachage du mot de passe, limitation de débit, TOTP, sessions révocables, jetons de réinitialisation à usage unique.
- Valider les points bloquants : type des identifiants (UUID ou texte : conditionne les clés étrangères), forme de la table de sessions (variante B-2), limitation de débit, protection contre l'énumération de comptes.
- Vérifier la version de PostgreSQL proposée par Railway (**15 ou plus requis** par `UNIQUE NULLS NOT DISTINCT`).
- **Livrable :** note de décision d'une page. **Sortie :** variante B-1/B-2 et bibliothèque choisies.

### B1 : Base de données (M)
- Rôles `app_migrator`, `app_runtime`, `app_public` ; schéma `private` conservé.
- Table des utilisateurs et sessions selon B0 ; `profiles` rattaché à cette table.
- Fonctions `private.current_user_id()`, `private.current_aal()` ; réécriture des fonctions d'aide RLS, de `my_permissions`, de `accept_invitation` (lecture de l'e-mail dans notre table).
- Réécriture de la migration RLS : mêmes politiques, mêmes privilèges par colonne, nouveaux rôles.
- **Exécuteur de migrations** minimal, sans dépendance lourde : fichiers SQL, table `schema_migrations` avec somme de contrôle, verrou consultatif, **avant seulement**, mêmes règles anti-destruction que `check-migrations`.
- Tests pgTAP réécrits (66 vérifications adaptées) + nouveaux tests : `app_runtime` n'est ni propriétaire ni `BYPASSRLS` ; **sans session valide, aucune ligne n'est visible** ; une session expirée ou falsifiée ne donne aucun droit ; MFA absente = aucun droit plateforme.
- **Sortie :** migrations appliquées sur une base vierge ; pgTAP vert.

### B2 : Couche d'accès aux données (M)
- Pilote PostgreSQL (`pg`), pool unique par rôle.
- Enveloppe `withSession(session, fn)` : ouvre une transaction, fixe la session, exécute, valide ou annule. **Aucune requête métier hors de cette enveloppe** (règle ESLint + test).
- Remplacement de `requireStoreAccess`, du sélecteur de magasin et des gardes SuperAdmin.
- **Sortie :** parcours magasin lisible de bout en bout sur base locale ; tests d'intégration d'isolation (deux utilisateurs, deux magasins) verts.

### B3 : Authentification (L, lot le plus risqué)
- Connexion, déconnexion, mot de passe oublié et réinitialisation, acceptation d'invitation, enrôlement et vérification TOTP, codes de secours, sessions révocables par appareil.
- Protection anti-force-brute **complète** (ce qui manquait en Phase 1) : limitation par IP et par compte stockée en base, CAPTCHA, verrouillage progressif, écriture dans `login_events`.
- Cookies `HttpOnly`, `Secure`, `SameSite`, rotation, durée courte.
- Pas d'inscription publique ; création de comptes uniquement par invitation.
- **Sortie :** tests unitaires et d'intégration ; E2E de connexion/MFA/reset ; revue de sécurité du lot par liste de contrôle (énumération, fixation de session, rejeu, comparaison à temps constant).

### B4 : E-mail et stockage (M)
- Fournisseur d'e-mail transactionnel (invitations, réinitialisation) ; domaine d'envoi avec SPF/DKIM/DMARC.
- Stockage de fichiers **compatible S3** : décision reportée à la Phase 3 (images produit), mais l'interface d'accès est posée maintenant. Contrairement à Supabase Storage, **la RLS ne protège pas les fichiers** : contrôle d'accès applicatif et URL signées de courte durée.
- **Sortie :** envoi réel en préproduction ; modèles en français.

### B5 : Exploitation sur Railway (M)
- Deux environnements Railway séparés (préproduction, production), chacun avec sa base ; base **non exposée sur Internet**, accessible via le réseau privé du projet.
- Variables : `DATABASE_URL` (rôle `app_runtime`), `DATABASE_URL_PUBLIC` (Phase 5), secret de session, clé e-mail. **Les identifiants du migrateur ne sont jamais sur le service applicatif.**
- Sauvegardes : instantanés Railway **et** export `pg_dump` planifié vers un stockage externe chiffré ; **test de restauration** en préproduction.
- Objectifs à valider (voir §7) : perte de données maximale acceptée (RPO) et durée de remise en service (RTO).
- Supervision minimale : sonde de santé, alertes d'échec de build et de sauvegarde.
- **Sortie :** déploiement de préproduction reproductible ; restauration démontrée.

### B6 : Revalidation et clôture de la Phase 1B (M)
- CI : base PostgreSQL éphémère **avec l'extension pgTAP** (l'image standard ne l'inclut pas ; image ou installation dédiée), contrôles statiques, build, E2E.
- Mise à jour de tous les documents (architecture, base, sécurité, déploiement) et du rapport de phase.
- **Sortie :** rapport de validation fondé sur des exécutions réelles ; votre autorisation avant la Phase 2.

## 5. Ordre, portes de validation et conséquence sur le calendrier

```
B0 → B1 → B2 → [Porte 1] → B3 → [Porte 2] → B4 → B5 → B6 → [Porte 3 = clôture Phase 1B]
```

| Porte | Contenu à exécuter par vous (ou par la CI) | Pourquoi ici |
|---|---|---|
| 1 | Migrations + pgTAP + isolation applicative (B1, B2) | La sécurité de la base doit être démontrée **avant** de construire l'authentification dessus |
| 2 | Authentification, MFA, anti-force-brute (B3) | Lot le plus risqué : validation isolée |
| 3 | Déploiement, sauvegardes, restauration, E2E (B4 à B6) | Clôture |

Les phases 2 et suivantes ne démarrent qu'après la porte 3. L'option B représente **à peu près le travail de la Phase 1 une seconde fois**, avec une partie sécurité plus exigeante (B3).

## 6. Limite de mon environnement de travail

Mon environnement n'a ni PostgreSQL, ni Docker, ni accès réseau. Je continuerai donc à **écrire le code et les tests, et à exécuter les contrôles statiques, mais je ne pourrai pas exécuter les migrations ni pgTAP**. Les portes 1 à 3 reposent sur des exécutions faites chez vous ou en CI. Plus tôt la CI existe, plus vite les erreurs sont détectées : je recommande de **mettre en place la CI (dépôt GitHub privé) dès B1**.

## 7. Décisions à valider avant de commencer

| # | Décision | Recommandation |
|---|---|---|
| DB1 | Identité dans la base | **B-2** : vérifiée par la base via la table des sessions |
| DB2 | Authentification | Better Auth **si** l'essai B0 confirme TOTP, UUID et sessions exploitables ; sinon solution minimale maison |
| DB3 | Exécuteur de migrations | Minimal maison (SQL, somme de contrôle, verrou, règles anti-destruction), plutôt qu'un outil de plus |
| DB4 | Sauvegardes | Instantanés Railway + `pg_dump` toutes les 6 heures vers un stockage externe chiffré. **Perte maximale d'environ 6 heures**, plus faible que la restauration à la seconde de Supabase. À confirmer comme acceptable |
| DB5 | Fournisseur d'e-mail | À choisir en B4 ; un domaine propre est nécessaire |
| DB6 | Fournisseur de stockage S3 | Reporté à la Phase 3 |
| DB7 | PostgreSQL ≥ 15 | Obligatoire ; à vérifier au moment de la création de la base Railway |
| DB8 | Environnement local | Docker Compose avec PostgreSQL (pas de Supabase CLI) |
| DB9 | Branche `option-a` | Conservée, jamais supprimée |

## 8. Risques propres à l'option B

| # | Risque | Gravité | Mitigation |
|---|---|---|---|
| RB1 | Défaut dans l'authentification maison (énumération, fixation de session, rejeu) | Critique | Bibliothèque éprouvée si l'essai B0 le permet ; liste de contrôle ; tests dédiés ; revue indépendante avant la production |
| RB2 | La base se fie à l'application pour l'identité | Élevée | Variante B-2 : identité dérivée d'une session vérifiée en base |
| RB3 | Perte de données plus importante qu'avec la restauration à la seconde | Élevée | `pg_dump` fréquent ; RPO accepté explicitement (DB4) ; test de restauration obligatoire |
| RB4 | Fichiers non protégés par la RLS | Élevée | Accès applicatif + URL signées ; décision en Phase 3 |
| RB5 | Les migrations réécrites contiennent des erreurs non détectées (aucune exécution possible ici) | Moyenne | CI avec PostgreSQL + pgTAP dès B1 ; porte 1 |
| RB6 | Base joignable depuis Internet par erreur | Élevée | Réseau privé uniquement ; vérifié à la porte 3 |
| RB7 | Absence de gestion d'e-mails (réception, SPF/DKIM) | Moyenne | Domaine configuré en B4 |
| RB8 | Dérive entre le plan et le code | Moyenne | Rapports de lot et mise à jour des documents à chaque porte |

## 9. Règles de protection (inchangées)

Aucune donnée existante supprimée ; aucune base distante réinitialisée ; aucune politique de sécurité désactivée ; aucune modification de la production sans autorisation écrite ; aucune phase suivante sans validation ; aucun secret dans la conversation ni dans le dépôt.
