# Plan de développement, tests et risques

## 1. Règle de passage de phase

Une phase est **terminée** uniquement si :

1. les migrations sont versionnées, relues et rejouables sur base locale ;
2. les tests automatisés de la phase passent (résultats réels, jamais supposés) ;
3. la documentation est à jour ;
4. un rapport de validation est remis (périmètre, fichiers, tests exécutés, limites connues) ;
5. le maître d'ouvrage donne son **autorisation écrite** de passer à la suivante.

Aucune migration n'est appliquée en préproduction ou production sans autorisation.

## 2. Phases

| Phase | Contenu | Livrables | Critères de sortie |
|---|---|---|---|
| **0** Conception | Analyse, architecture, schéma, sécurité, design system, plan | Documents `docs/` | Validation (voir `00-decisions.md`) |
| **1** Fondations | 1.1 Dépôt, CI, environnements · 1.2 Migrations noyau · 1.3 Auth, MFA, invitations · 1.4 RLS + suite pgTAP d'isolation · 1.5 Design system, AppShell, registre de modules | Application sécurisée : connexion, sélection de magasin, layout | Tests d'isolation verts ; accès par modification d'URL/ID refusé ; build sans secret |
| **2** SuperAdmin | Dashboard, magasins (cycle de vie), catégories et champs, utilisateurs, plans, abonnements, **paiement manuel validé**, suspension/réactivation, support | Plateforme administrable | Création de magasin transactionnelle ; limites de plan appliquées côté serveur |
| **3** Gestion commerciale | Produits (variantes, lots, import/export Excel) → stock (grand livre) → caisse (sessions, `create_sale`, retours, impression) → clients/crédit → fournisseurs/achats → finances/rapports | Logiciel de gestion opérationnel | Tests de concurrence de stock ; cohérence vente/stock/paiement ; E2E vente complète |
| **4** Modules métier | **4a** champs dynamiques : alimentation/épicerie, cosmétique, librairie, sport, jouets · **4b** quincaillerie (devis), boucherie (poids), électroménager (séries, SAV) · **4c** boulangerie (recettes, production), multiservices | 11 interfaces spécialisées | Par module : manifeste, menu, champs, tests, documentation |
| **5** Boutique client | Boutique publique, QR `/q/code`, catalogue, panier, commandes, suivi, PWA | Expérience client opérationnelle | Tests d'abus ; Lighthouse mobile ; QR vérifiés |
| **6** Marketing | Bannières, carrousel, promotions, nouveautés, notifications | Espace marketing | Accessibilité du carrousel ; respect des périodes |
| **7** Paiements | Wave / Orange Money, webhooks vérifiés, reçus, renouvellement, relances | Facturation automatisée | Webhooks falsifiés/rejoués rejetés ; rapprochement montant/devise |
| **8** Avancé | Multi-sites, transferts, rapports avancés, fidélité, comptes clients, option hors-ligne | | |
| **9** Audit et lancement | Tests de charge, audit sécurité, test de restauration, conformité, formation, production | | Critères de la partie 18 du cahier |

**MVP commercialisable :** phases 1, 2, 3, 5, avec paiement manuel (Phase 2). Les intégrations Mobile Money (Phase 7) ne bloquent pas la commercialisation.

## 3. Phase 1 : détail

| Lot | Tâches | Vérification |
|---|---|---|
| 1.1 | Dépôt neuf, Next.js + TypeScript, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, Playwright ; versions figées ; CI (types, lint, tests, build, gitleaks) ; `.env.example` (noms uniquement) | CI verte sur dépôt vide |
| 1.2 | Supabase CLI local ; migrations : extensions, schémas, `profiles`, plateforme, `stores`, `store_locations`, rôles/permissions/membres, `audit_logs`, helpers, triggers `updated_at` et `store_id` immuable ; seed fictif des rôles et permissions | Migrations rejouées sur base locale vierge |
| 1.3 | Connexion/déconnexion, réinitialisation, MFA SuperAdmin, invitations, middleware de session, sélecteur de magasin, garde de route côté serveur | Tests d'intégration auth |
| 1.4 | RLS sur toutes les tables du noyau ; suite pgTAP d'isolation générée ; tests IDOR | Aucune lecture/écriture inter-magasin possible |
| 1.5 | Jetons de design, AppShell, composants de base, registre de modules, page 403/404/erreur, i18n `fr` | Revue visuelle desktop/tablette/mobile + axe |

Livrable de Phase 1 : rapport de tests réels, documentation à jour, aucune donnée de production touchée.

## 4. Stratégie de tests

| Niveau | Outils | Couverture |
|---|---|---|
| Unitaire | Vitest | prix, remises, marges, calculs d'abonnement, validation Zod, permissions, arithmétique monétaire |
| Base de données | pgTAP | RLS, contraintes, triggers, fonctions RPC |
| Intégration | Vitest + Supabase local | auth, création de magasin, produit, vente, stock, paiement, commande, abonnement, suspension, réactivation |
| Sécurité | pgTAP + Vitest + Playwright | voir `security.md` §11 |
| E2E | Playwright | parcours en 12 étapes du cahier (création de magasin → réactivation) |
| Accessibilité / performance | axe, Lighthouse | boutique et caisse |

Les tests utilisent exclusivement des données fictives. Aucun test ne s'exécute contre la production.

## 5. Registre de risques

| # | Risque | Gravité | Mitigation | Phase |
|---|---|---|---|---|
| R1 | Fuite inter-tenant | Critique | Clés composites, `FORCE RLS`, pgTAP généré, relecture des fonctions privilégiées | 1 et continue |
| R2 | Fuite de la service role key | Critique | Module `server-only`, gitleaks, rotation | 1 |
| R3 | Faux webhooks / activation frauduleuse | Critique | Signature, contre-vérification, idempotence, montant/devise | 7 |
| R4 | Compromission SuperAdmin | Critique | MFA AAL2 en RLS, niveaux, création hors application, audit | 1-2 |
| R5 | Incohérence de stock | Élevée | Verrous, grand livre, tests de concurrence | 3 |
| R6 | Abus de la boutique publique | Élevée | Captcha, limitation de débit, jetons non devinables | 5 |
| R7 | Uploads malveillants | Élevée | Liste blanche, signature, ré-encodage, pas de SVG utilisateur | 3, 5 |
| R8 | Performance RLS | Faible (20 magasins) | Initplan, index `store_id` ; partitionnement différé | 9 |
| R9 | Sauvegardes insuffisantes | Élevée | Plan avec restauration ponctuelle, exports, test de restauration | 9 |
| R10 | Caisse dépendante du réseau | Moyenne | Connexion fiable confirmée ; idempotence prévue | 8 |
| R11 | QR imprimés cassés | Moyenne | Code immuable + historique de slugs | 5 |
| R12 | Dérive des champs JSONB | Moyenne | Zod généré, contrainte de type, migration lors de suppression de champ | 4 |
| R13 | Compte créé hors transaction | Moyenne | Modèle par invitation | 1-2 |
| R14 | Conformité (données personnelles, TVA, services financiers) | Élevée | Juriste et comptable avant lancement ; pas d'intégration d'opérateur financier | 9 |
| R15 | Accès API Mobile Money | Moyenne | Vérifier le type d'accès ; paiement manuel dès la Phase 2 | 7 |
| R16 | Latence / région | Moyenne | Mesure avant création du projet de production | avant 9 |
| R17 | Périmètre très large | Élevée | Phasage strict, MVP défini, modules par lots | continue |
| R18 | **Intégration avec le projet existant** | Élevée | Gate A : audit d'abord ; migrations additives ; aucun accès avant | avant intégration |
| R19 | Erreur de conception dans les extraits SQL | Moyenne | Toute DDL est testée en migration réelle avant validation (voir erreur corrigée ci-dessous) | 1 |

### Correction effectuée en Phase 0
Dans la première version du schéma présentée en conversation, la clé primaire de `stock_levels` incluait `batch_id`, colonne nullable : PostgreSQL l'interdit. La conception retenue utilise une clé primaire `id` et une contrainte `UNIQUE NULLS NOT DISTINCT (store_id, location_id, variant_id, batch_id)`. Ce type d'écart justifie que chaque DDL soit exécutée sur une base locale avant d'être déclarée valide.

## 6. Plans d'abonnement (placeholders)

Prix et limites non définis (D17). Livrés comme données fictives : Starter, Business, Premium, Enterprise, avec valeurs « à définir », modifiables dans le SuperAdmin. Aucune limite commerciale n'est codée en dur.
