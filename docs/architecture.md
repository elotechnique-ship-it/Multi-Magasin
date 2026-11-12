# Architecture technique

> **Partiellement caduc (option B).** Ce document décrit le modèle Supabase (`auth.uid()`, `auth.users`, rôles `anon`/`authenticated`, JWT). Pour l'option B voir `b0-decision-note.md` et `option-b-plan.md` ; il sera réécrit au lot B6. Les principes (isolation par magasin, refus par défaut, journaux en ajout seul) restent inchangés.


## 1. Vue d'ensemble

```
             ┌──────────────────── Next.js (App Router, TypeScript) ────────────────────┐
Navigateur ─►│ /superadmin  /magasin/[slug]/…  /boutique/[slug]  /q/[code]  /auth       │
             │ Server Components · Server Actions · Route Handlers (webhooks)           │
             └───────┬──────────────────────────────┬───────────────────────────────────┘
                     │ client "utilisateur"         │ client "admin" (service role)
                     │ clé anon + JWT → RLS         │ module `server-only`, usages limités
                     ▼                              ▼
          ┌─────────────────────────── Supabase ───────────────────────────┐
          │ Auth (+MFA) │ PostgreSQL (RLS, RPC, triggers) │ Storage        │
          │ Edge Functions : webhooks paiement, jobs d'abonnement, emails   │
          └────────────────────────────────────────────────────────────────┘
```

Quatre surfaces : **SuperAdmin**, **application commerçant**, **boutique client (PWA)**, **backend sécurisé**.

## 2. Principes structurants

1. **La base de données est la frontière de sécurité.** RLS sur toutes les tables ; le frontend n'est que de l'ergonomie.
2. **Deux clients Supabase seulement.** Le client « utilisateur » passe par RLS. Le client « admin » (service role) est confiné à un module `server-only` et réservé aux webhooks, invitations Auth et tâches planifiées. Une règle ESLint et un test de build interdisent son import côté client.
3. **Opérations sensibles = fonctions SQL transactionnelles** (`create_sale`, `apply_stock_movement`, `confirm_payment`, `create_store`, `shop_create_order`…). Elles vérifient elles-mêmes permissions, état du magasin et limites de plan.
4. **Magasin actif dans l'URL**, jamais dans un état de session modifiable.
5. **Noyau commun + modules** : un seul code, des capacités activables par catégorie, plan et store.
6. **Intégrité tenant dans les clés étrangères** : clés composites `(store_id, id)`.
7. **Journaux en ajout seul** : mouvements de stock, audit, événements de sécurité.
8. **Idempotence** de toute opération rejouable (ventes, webhooks, commandes).

## 3. Organisation du code

```
app/
├── (public)/            accueil, tarifs, contact
├── auth/                connexion, invitation, mot de passe oublié, MFA
├── superadmin/          dashboard, magasins, categories, abonnements, paiements,
│                        utilisateurs, support, rapports, parametres
├── magasin/[storeSlug]/ dashboard, caisse, produits, stock, ventes, clients, fournisseurs,
│                        achats, finances, commandes, marketing, equipe, parametres
│                        + routes de modules (ex. decoupe/, recettes/, sav/)
├── boutique/[slug]/     catalogue, produit, panier, commande, suivi
├── q/[code]/            redirection QR → boutique courante
└── api/
    ├── webhooks/[provider]/   signature vérifiée, idempotence
    └── health/
components/  ui · layout · dashboard · caisse · produits · stock · boutique · superadmin · shared
lib/         supabase · auth · permissions · validation · security · billing ·
             services · money · modules · utils
modules/     alimentation · quincaillerie · multiservices · cosmetique · electromenager ·
             epicerie · boucherie · boulangerie · librairie · sport · jouets
supabase/    migrations · functions · tests (pgTAP) · seed (données fictives)
tests/       unit · integration · e2e
docs/
```

Écarts par rapport à la structure du cahier : `magasin/[storeSlug]`, `q/[code]`, `api/webhooks`, `lib/money`, `lib/modules`, tests pgTAP.

## 4. Architecture modulaire des catégories

### 4.1 Manifeste de module

```ts
export const manifest: ModuleManifest = {
  code: "boucherie",
  requiresCapabilities: ["weight_sales", "batches_expiry"],
  menu: [{ label: "Découpe", href: "decoupe", permission: "products.view" }],
  productFields: [/* définitions de champs */],
  permissions: ["cutting.manage"],
  widgets: ["pertes-du-jour"],
  settingsSchema: zodSchema,
};
```

Le menu, les routes et les widgets d'un store sont construits à partir du registre.

### 4.2 Trois niveaux de spécialisation

1. **Champs dynamiques** : `category_fields` → `products.attributes` (JSONB). Formulaire et schéma Zod générés. Ajout d'un champ sans déploiement.
2. **Capacités transversales** : variantes, lots/péremption, vente au poids, numéros de série/garantie, devis.
3. **Tables dédiées** : recettes/production, SAV, devis, catalogue de prestations.

### 4.3 Matrice catégories → capacités

| Catégorie | Capacités | Spécifique |
|---|---|---|
| Alimentation / Épicerie | lots + péremption, conditionnements, pertes | alertes de péremption |
| Quincaillerie | attributs techniques, conditionnements, devis | produits compatibles, vente professionnelle |
| Multiservices | produits de type *service* | catalogue de prestations, transactions, rapports par opérateur |
| Cosmétique | variantes (nuance, taille), lots + péremption | marques, promotions |
| Électroménager | numéros de série, garanties, devis | SAV, livraison, installation |
| Boucherie-Charcuterie | vente au poids, lots, pertes | découpe, traçabilité |
| Boulangerie-Pâtisserie | recettes, production, matières premières | commandes personnalisées, coût de production |
| Librairie-Papeterie | attributs (ISBN, auteur, éditeur) | recherche par ISBN |
| Sport | variantes taille × couleur | stock par variante |
| Jouets | variantes, attributs (âge, type) | promotions |
| Autres | noyau seul | champs configurables |

**Activation effective** = `category_modules` (défaut) ∩ `plan_features` (autorisé par le plan) ∩ `store_modules` (choix du store). Contrôle côté serveur : garde de route + vérification dans les RPC.

## 5. Flux critiques

### 5.1 Création de magasin (transactionnelle)
1. Le SuperAdmin appelle `create_store(...)` : une seule transaction SQL crée store, paramètres, site par défaut, rôles associés, abonnement d'essai et **invitation** (jeton haché).
2. L'invitation est envoyée par email (Edge Function).
3. À l'acceptation, le compte Auth est créé puis `accept_invitation(token)` rattache le membre `owner`.
4. Conséquence : jamais de store sans propriétaire, jamais de compte orphelin.

### 5.2 Vente (`create_sale`)
1. Vérifie `sales.create`, `store_is_writable`, session de caisse ouverte.
2. Idempotence sur `client_uuid`.
3. Relit les prix en base ; contrôle les remises (`sales.discount`).
4. Verrouille les lignes de stock (`FOR UPDATE`, ordre déterministe).
5. Insère vente, lignes, paiements, mouvements de stock ; met à jour les soldes.
6. Refuse le stock négatif sauf autorisation explicite du commerçant.
7. Annulations/retours = écritures compensatoires, jamais de suppression.

### 5.3 QR Code
Le QR encode `https://domaine/q/{public_code}` : un code **immuable** qui redirige vers le slug courant. Un QR imprimé ne casse donc jamais. `store_slug_history` redirige aussi les anciens liens. QR généré côté serveur (PNG, SVG).

### 5.4 Boutique et commandes
- Lecture publique par fonctions à colonnes en liste blanche (`shop_get_store`, `shop_list_products`, `shop_get_banners`).
- Commande par `shop_create_order` : prix recalculés en base, store et plan vérifiés, captcha + limitation de débit.
- Suivi par `public_token` (128 bits), jamais par identifiant séquentiel.
- PWA : cache limité au shell et aux contenus publics, aucune donnée authentifiée en cache.

### 5.5 Cycle d'abonnement
`trial → active → overdue → (grâce) → suspended`, `canceled`, `expired`. Job quotidien. Seule une fonction privée met à jour `stores.access` (`full`, `read_only`, `blocked`).

## 6. Environnements et déploiement

| Environnement | Base | Données | Accès |
|---|---|---|---|
| Local | Supabase CLI (Docker) | fictives | développeurs |
| Préproduction | projet Supabase distinct | fictives | équipe |
| Production | projet Supabase dédié | réelles | restreint, migrations après autorisation |

CI : TypeScript, lint, tests unitaires, intégration, pgTAP, build, scan de secrets (gitleaks), contrôle des migrations (aucune opération destructive sans marqueur d'approbation). Les migrations sont **appliquées en production manuellement, après autorisation écrite**.

## 7. Stack
Next.js, TypeScript, React, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions), Zod, React Hook Form, Recharts, Vitest, Playwright, pgTAP, `next-intl`. Versions figées à la création du dépôt.
