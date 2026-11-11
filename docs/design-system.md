# Design system

## 1. Direction

Moderne, sobre, premium, cohérent. Une seule identité visuelle sur trois contextes d'usage (back-office, caisse, boutique). La palette reste configurable par jetons sémantiques.

## 2. Couleurs

La palette suggérée dans le cahier est conservée comme identité. Deux combinaisons échouent au contraste WCAG AA pour du texte normal (ratio minimal 4,5:1) :

- texte blanc sur `#0EA5A4` : ≈ 3,0:1
- texte blanc sur `#F59E0B` : ≈ 2,1:1

| Jeton | Valeur | Usage |
|---|---|---|
| `--navy-900` | `#0F172A` | Sidebar, titres, texte principal |
| `--primary-600` | `#0F766E` | Boutons, liens (texte blanc ≈ 5,5:1) |
| `--primary-500` | `#0EA5A4` | Accents, icônes, graphiques, grands aplats |
| `--accent-500` | `#F59E0B` | Promotions, badges, **toujours avec texte navy** |
| `--bg` | `#F8FAFC` | Fond de page |
| `--surface` | `#FFFFFF` | Cartes, modales |
| `--success`, `--warning`, `--danger`, `--info` | à fixer en Phase 1 avec vérification de contraste | États |

Règle : un état n'est jamais porté par la couleur seule (icône ou texte associé). Un mode sombre est prévu dans les jetons mais livré après le MVP.

### Personnalisation par magasin
Le commerçant peut définir logo et couleur principale de sa boutique. Un **garde-fou de contraste** corrige ou refuse toute couleur rendant le texte illisible (ratio < 4,5:1).

## 3. Typographie et formats

- Police sans-serif lisible (Inter ou Plus Jakarta Sans), chargée localement, repli système.
- Échelle modulaire ; **chiffres tabulaires** pour les montants et tableaux.
- Montants : `Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF' })`, via `lib/money`.
- Dates : fuseau du store, format français.

## 4. Grille et formes

Unité de base 4 px ; espacements 4/8/12/16/24/32/48. Rayons 6/10/16 px. Ombres légères à trois niveaux. Icônes Lucide. Largeur de contenu maîtrisée en back-office.

## 5. Composants (livrés en Phase 1)

AppShell, Sidebar (pilotée par le registre de modules), Topbar (recherche globale `Ctrl/Cmd+K`, notifications, profil), KPI Card, DataTable (pagination, tri et filtres côté serveur), formulaires (React Hook Form + Zod, messages d'erreur clairs), Modal et Drawer, Toast, ConfirmDialog (obligatoire pour toute action destructive), StatusBadge, MoneyInput, EmptyState, ErrorState, Skeleton, Breadcrumbs.

Chaque composant couvre ses états : normal, survol, focus visible, désactivé, chargement, erreur, vide.

## 6. Trois modes d'interface

| Contexte | Particularités |
|---|---|
| **Back-office** (SuperAdmin, commerçant) | Densité confortable, tableaux riches, KPI et graphiques Recharts, navigation latérale repliable |
| **Caisse** | Plein écran tactile ; cibles ≥ 48 px ; grille produits + panier ; scan code-barres ; raccourcis clavier ; très peu de saisie ; retour visuel immédiat ; impression 58/80 mm |
| **Boutique client** | Mobile d'abord ; légère (Core Web Vitals) ; images optimisées ; PWA installable ; carrousel accessible |

## 7. Accessibilité

- Contraste AA minimum, focus visible, navigation clavier complète.
- Libellés et rôles ARIA sur les composants interactifs ; formulaires avec erreurs associées aux champs.
- Carrousel : pause, boutons précédent/suivant, respect de `prefers-reduced-motion`, jamais de défilement automatique sans contrôle.
- Cibles tactiles ≥ 44 px (48 px en caisse).
- Audit automatisé (axe) dans les tests E2E.

## 8. Responsive

Ordinateur, tablette, smartphone Android, iPhone. Points de rupture Tailwind standard. Tableaux : défilement horizontal interne ou vue en cartes sur mobile.
