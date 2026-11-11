# Journal des décisions : Phase 0

**Projet :** Plateforme SaaS de gestion commerciale multi-magasins
**Date :** 10 novembre 2026
**Statut :** Décisions arrêtées sur délégation du maître d'ouvrage (« faites ce qui vous semble le plus professionnel »). Révisables sur demande.

## 1. Règles de protection (rappel contractuel)

1. Aucune donnée existante n'est supprimée.
2. Aucune base Supabase distante n'est réinitialisée. Seules les bases **locales ou éphémères de CI** (jetables, sans donnée réelle) peuvent être rejouées depuis zéro.
3. Aucune politique RLS n'est désactivée pour « débloquer » un problème.
4. Aucune modification de production sans autorisation écrite.
5. Aucune phase ne commence sans que la précédente soit terminée, testée, documentée et validée.
6. Aucun secret n'est partagé dans la conversation, ni commité, ni exposé au frontend.
7. Aucune fonctionnalité n'est déclarée terminée sans vérification ; aucun résultat de test n'est inventé.

## 2. Décisions

| # | Décision | Choix retenu |
|---|---|---|
| D1 | Unité de tenant | `store`. Les points de vente sont des `store_locations` internes au store. Un utilisateur peut être membre de plusieurs stores. |
| D2 | Montants | Entiers en unités mineures (`bigint`). XOF par défaut (0 décimale). Quantités en `numeric(14,3)`. |
| D3 | Contexte de magasin | Dans l'URL : `/magasin/[storeSlug]/…`. Chaque requête est revérifiée par RLS. |
| D4 | Création de comptes | Inscription publique fermée. Accès commerçant par **invitation** émise par le SuperAdmin (jeton haché, usage unique, expiration). |
| D5 | SuperAdmin | Table `platform_admins` séparée ; création hors application par procédure d'administration ; MFA (AAL2) imposé dans les politiques RLS ; niveaux `owner`, `support`, `finance`. |
| D6 | Suspension | Rappels à J-3 et J0 ; délai de grâce de 7 jours (paramétrable par plan) ; puis **lecture seule** (consultation, export, page de facturation et paiement ; plus de vente). Jamais de suppression. |
| D7 | Paiements des commandes en ligne | La plateforme **ne collecte pas** l'argent des clients finaux : paiement au retrait/livraison, ou Mobile Money déclaré vers le commerçant. |
| D8 | Commandes en ligne | Sans compte client au départ (nom + téléphone), suivi par jeton aléatoire de 128 bits. Comptes clients optionnels en Phase 8. |
| D9 | Caisse | En ligne uniquement pour le MVP (connexion fiable confirmée). Idempotence `client_uuid` prévue pour un hors-ligne ultérieur. |
| D10 | Multiservices | Suivi comptable manuel des prestations ; aucune intégration d'opérateur financier. |
| D11 | Notifications | Email + notifications push PWA. SMS/WhatsApp ultérieurement, en option. |
| D12 | Hébergement | **Next.js et PostgreSQL sur Railway** (décisions du maître d'ouvrage, 11 nov. 2026). Voir D21 : Supabase n'est plus utilisé. Région Supabase **à fixer avant la création du projet de production**, après mesure de latence depuis Dakar (la région ne se change pas facilement ensuite). |
| D13 | Environnements | Développement (Supabase CLI local + projet dev), préproduction (projet séparé, données fictives), production (accès restreint). |
| D14 | Palette | Turquoise foncé `#0F766E` pour boutons/liens, `#0EA5A4` pour accents ; texte navy sur orange. Voir `design-system.md`. |
| D15 | Catégories | 12 catégories en base, 11 packs métier (Alimentation et Épicerie partagent un pack). Champs dynamiques pilotés par le SuperAdmin. |
| D16 | Rôles personnalisés par store | Réservés aux plans supérieurs. |
| D17 | Plans d'abonnement | Prix et limites **non définis** : livrés comme données fictives « à définir », modifiables par le SuperAdmin. |
| D18 | Sauvegardes | Production sur un plan Supabase offrant la restauration à un instant donné (à vérifier à la création) + exports chiffrés complémentaires ; restauration testée en préproduction avant lancement. |
| D19 | Volumétrie de dimensionnement | 20 magasins visés à 12 mois. Partitionnement différé ; index et schéma prévus pour grossir. |
| D21 | **Option B : Railway seul, sans Supabase** | Décision du maître d'ouvrage, 11 nov. 2026. Authentification, sessions, double authentification, e-mails, sauvegardes et stockage sont remplacés par des composants maîtrisés. Plan : `option-b-plan.md`. Les livrables de l'option A restent dans la branche `option-a` et le zip existant. Remplace les décisions D18 (sauvegardes Supabase) et la partie Supabase de D13. |
| D20 | Paiement Mobile Money | Accès marchand disponible. Intégration en Phase 7, après vérification du type d'accès (API/checkout/callback). Paiement manuel validé par SuperAdmin dès la Phase 2. |

## 3. Portes de contrôle ouvertes

| Porte | Description | État |
|---|---|---|
| **Gate A** | **Audit du projet existant** (code, schéma, RLS, migrations, comptes, buckets, variables d'environnement). Le maître d'ouvrage a indiqué qu'un projet existe, mais aucun export n'a été fourni. | **Ouverte** : l'intégration à l'existant est impossible tant qu'elle n'est pas close. |
| **Gate B** | Autorisation explicite de démarrer la Phase 1. | **Close** : « GO Phase 1 » reçu. |
| **Gate D** | Validation de la Phase 1 : exécution réelle des migrations, tests pgTAP, build et E2E (voir `phase1-report.md`). | **Ouverte** : la Phase 2 ne démarre pas avant. |
| **Gate F** | Validation du plan de l'option B (`option-b-plan.md`) : décisions DB1 à DB9. | **Ouverte** : aucun code n'est écrit ou modifié avant cet accord. |
| **Gate E** | Déploiement Railway. | **Autorisé pour la PRÉPRODUCTION uniquement**, avec une base NEUVE (la procédure `deployment-railway.md`, écrite pour l'option A, est à réécrire en lot B5) (interprétation de la demande du 11 nov. 2026 : « déployer directement avec Railway »). La production réelle et le projet existant restent **non autorisés**. À corriger si cette interprétation est inexacte. |
| **Gate C** | Région Supabase de production et fournisseur d'email. | Ouverte (non bloquante pour la Phase 1) |

**Conséquence sur la Phase 1.** Elle peut démarrer dans un **dépôt neuf et un projet Supabase de développement neuf**, strictement isolés de l'existant. Rien n'est branché sur le projet existant avant la clôture de la Gate A, et toute intégration se fera par migrations additives après audit.

## 4. Hypothèses de travail

- Un seul fuseau horaire par défaut (`Africa/Dakar`), français comme langue unique de l'interface au lancement (i18n prévue).
- Les versions des dépendances seront figées à la création du dépôt (dernières versions stables à cette date) et consignées.
- Les obligations légales sénégalaises (données personnelles, facturation, TVA) seront validées par un juriste et un comptable avant la mise en production.
