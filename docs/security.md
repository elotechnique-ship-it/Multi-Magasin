# Modèle de sécurité

## 1. Surfaces et acteurs

| Acteur | Identité | Accès |
|---|---|---|
| SuperAdmin | `platform_admins` (MFA obligatoire) | Plateforme, selon niveau |
| Membre de magasin | `store_members` + rôles | Données de ses magasins, selon permissions |
| Client final | Aucun compte au départ | Boutique publique et suivi par jeton |
| Visiteur anonyme | rôle `anon` | Fonctions publiques à colonnes en liste blanche uniquement |
| Prestataire de paiement | Webhook signé | Confirmation de paiement, après contre-vérification |

`customer` et `platform_admin` ne sont **pas** des rôles de magasin.

## 2. Rôles et permissions

Rôles système : `owner`, `store_admin`, `manager`, `cashier`, `stock_manager`, `accountant`, `salesperson`, `delivery_agent`. Les permissions sont atomiques, stockées en base (`role_permissions`) et jamais codées en dur dans les politiques.

Catalogue : `products.view|create|update|delete|update_price|view_cost`, `stock.view|adjust|transfer|count`, `sales.create|cancel|return|discount|view|view_profit`, `cash.open|close`, `customers.view|manage|manage_credit`, `suppliers.manage`, `purchases.manage`, `finance.view|manage`, `reports.view`, `orders.view|manage|deliver`, `marketing.manage`, `users.manage`, `settings.manage`, `billing.view|manage`, `audit.view`, `locations.manage`.

### Matrice par défaut (modifiable)

O = owner · A = store_admin · M = manager · C = cashier · S = stock_manager · F = accountant · V = salesperson · D = delivery_agent. ◐ = limité (seuil ou lecture).

| Capacité | O | A | M | C | S | F | V | D |
|---|---|---|---|---|---|---|---|---|
| Voir produits | ● | ● | ● | ● | ● | ● | ● | |
| Créer/modifier produits | ● | ● | ● | | ● | | | |
| Modifier prix de vente | ● | ● | ● | | | | | |
| Voir prix d'achat | ● | ● | ● | | ● | ● | | |
| Archiver produits | ● | ● | ● | | | | | |
| Voir le stock | ● | ● | ● | ◐ | ● | ● | ● | |
| Ajuster le stock | ● | ● | ● | | ● | | | |
| Créer des ventes | ● | ● | ● | ● | | | ● | |
| Remises | ● | ● | ● | ◐ | | | ◐ | |
| Annulations et retours | ● | ● | ● | | | | | |
| Voir les marges | ● | ● | ● | | | ● | | |
| Session de caisse | ● | ● | ● | ● | | | | |
| Clients (voir/gérer) | ● | ● | ● | ● | | | ● | |
| Crédit client | ● | ● | ● | | | | | |
| Fournisseurs et achats | ● | ● | ● | | ◐ | ◐ | | |
| Finances | ● | ● | ◐ | | | ● | | |
| Rapports | ● | ● | ● | | | ● | | |
| Commandes en ligne | ● | ● | ● | | | | ● | ◐ |
| Marketing | ● | ● | ● | | | | | |
| Équipe | ● | ● | | | | | | |
| Paramètres | ● | ● | | | | | | |
| Facturation/abonnement | ● | ◐ | | | | | | |
| Journal d'audit | ● | ● | | | | | | |

**Colonnes sensibles.** La RLS filtre des lignes, pas des colonnes. Les coûts et marges sont exposés par vues ou RPC conditionnées à `products.view_cost` / `sales.view_profit` ; ces colonnes ne sont pas lisibles directement par les rôles qui n'y ont pas droit.

## 3. Isolation multi-tenant

### 3.1 Fonctions d'aide (schéma `private`)

```sql
create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins a
                 where a.user_id = (select auth.uid()) and a.disabled_at is null)
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

create function private.has_permission(p_store uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_members m
    join public.member_roles mr on mr.member_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    where m.store_id = p_store and m.user_id = (select auth.uid())
      and m.status = 'active' and rp.permission_code = p_perm);
$$;

create function private.store_is_writable(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores s
                 where s.id = p_store and s.status = 'active' and s.access = 'full');
$$;

create function private.forbid_store_id_change() returns trigger language plpgsql as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception 'store_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;
```

Règles sur les fonctions `SECURITY DEFINER` : `search_path = ''`, noms qualifiés, `EXECUTE` retiré à `PUBLIC` et `anon`, relecture obligatoire à chaque ajout. Les droits ne sont **pas copiés dans le JWT** (ils resteraient valables après révocation) : ils sont lus en base.

### 3.2 Patron de politiques

```sql
alter table public.products enable row level security;
alter table public.products force row level security;

create policy products_select on public.products for select to authenticated
  using (private.has_permission(store_id, 'products.view') or private.is_platform_admin());

create policy products_insert on public.products for insert to authenticated
  with check (private.has_permission(store_id, 'products.create') and private.store_is_writable(store_id));

create policy products_update on public.products for update to authenticated
  using      (private.has_permission(store_id, 'products.update') and private.store_is_writable(store_id))
  with check (private.has_permission(store_id, 'products.update') and private.store_is_writable(store_id));

-- Pas de policy DELETE : suppression logique via UPDATE.
create trigger products_store_immutable before update on public.products
  for each row execute function private.forbid_store_id_change();
```

**Correction (Phase 1).** La version précédente de ce document enveloppait ces appels dans `(select ...)` pour une « évaluation unique par requête ». C'était inexact : l'argument `store_id` dépend de la ligne, donc l'appel ne peut pas être extrait en sous-requête indépendante. L'optimisation est appliquée **à l'intérieur** des fonctions d'aide, où `auth.uid()` et `auth.jwt()` sont enveloppés dans `(select ...)`. Le coût par ligne reste faible (recherche indexée sur `store_members`), acceptable pour 20 magasins ; à mesurer en Phase 9.

### 3.3 Règles transversales

1. Toute table de `public` a RLS **activée et forcée**. Un test CI échoue si ce n'est pas le cas.
2. Tables d'état critique (`stock_levels`, paiements de vente, `subscriptions`, `payment_transactions`, `stores.access`) : lecture via RLS, **écriture uniquement par RPC**.
3. Tables d'audit et de facturation : aucun privilège d'écriture direct pour `anon` ni `authenticated`.
4. La suspension passe par `store_is_writable` : en `read_only`, les écritures métier sont refusées par la base, pas seulement masquées dans l'interface.

## 4. SuperAdmin

- Table séparée, jamais un drapeau dans `profiles`.
- Création/promotion par procédure d'administration (CLI avec service role, hors application), journalisée.
- MFA TOTP obligatoire, appliqué dans les politiques (`aal2`).
- Niveaux : `owner` (tout), `support` (lecture, tickets ; jamais les paiements), `finance` (abonnements, paiements).
- Aucune « impersonation » par mot de passe. Un accès support éventuel est en lecture seule, limité dans le temps, journalisé.
- Servi idéalement depuis un sous-domaine dédié.

## 5. Authentification et comptes

- Supabase Auth ; inscription publique fermée ; accès par invitation (jeton haché, usage unique, expiration).
- Protection contre la force brute : limites Auth, captcha, table `login_events`, verrouillage progressif.
- Sessions courtes, rotation des refresh tokens, liste et révocation des appareils.
- Mots de passe : jamais affichés ni stockés par l'application ; réinitialisation par lien sécurisé.

## 6. Boutique publique et commandes

- `anon` n'a **aucun accès direct** aux tables.
- Lecture : `shop_get_store`, `shop_list_products`, `shop_get_banners` (colonnes en liste blanche ; pas de prix d'achat ; stock selon `shop_stock_display`).
- Commande : `shop_create_order` recalcule les prix en base, vérifie store actif et plan, applique captcha (Turnstile ou équivalent) et limitation de débit par IP/téléphone.
- Suivi : `public_token` aléatoire de 128 bits ; aucune énumération possible.
- QR : ne contient que l'URL de redirection `/q/{public_code}`, aucune donnée sensible.

## 7. Storage

- `store-public` : logos, images produit, bannières. Chemin imposé `{store_id}/…` ; écriture limitée aux membres autorisés par politique sur `storage.objects`.
- `store-private` : exports, reçus, documents ; URL signées de courte durée.
- Uploads : liste blanche de types MIME vérifiés par signature de fichier, taille maximale, ré-encodage des images, **aucun SVG fourni par l'utilisateur**, quota par plan.

## 8. Paiements d'abonnement

1. Le webhook est reçu par un Route Handler ou une Edge Function qui **vérifie la signature**.
2. Enregistrement dans `webhook_events` (idempotence sur `(provider, event_id)`).
3. **Contre-vérification** auprès du prestataire (appel serveur à serveur).
4. Contrôle montant, devise, facture.
5. `private.confirm_payment()` : une transaction met à jour transaction, facture, abonnement, `stores.access` et audit.
6. L'URL de succès côté navigateur **n'active jamais** un abonnement.
7. Remboursements : action contrôlée, réservée au niveau `finance`/`owner`, double écriture d'audit.

## 9. Secrets et configuration

- Clé service role et clés de prestataires : uniquement variables d'environnement sécurisées côté serveur ; jamais dans Git, le frontend, les journaux ou la conversation.
- Scan de secrets en CI (gitleaks) ; test de build vérifiant l'absence de clés privées dans le bundle client.
- Rotation documentée ; variables nécessaires listées dans `docs/deployment.md` (noms uniquement).
- En-têtes : CSP stricte, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, protection du clickjacking.

## 10. Journalisation et audit

- `audit_logs` en ajout seul : acteur, store, action, entité, avant/après (champs sensibles masqués), IP, horodatage.
- `login_events`, `security_events` (échecs répétés, accès refusés, webhooks invalides).
- Erreurs renvoyées au client sans détail interne.

## 11. Tests de sécurité obligatoires

| Catégorie | Contrôle |
|---|---|
| Isolation (pgTAP) | Pour **chaque** table : un membre du store A ne peut ni lire, ni insérer, ni modifier, ni déplacer (`store_id`) une ligne du store B |
| IDOR | Modification d'identifiant dans l'URL, dans le corps d'une requête, dans une requête API directe : refus |
| Permissions | Chaque rôle testé contre la matrice ; refus pour les permissions absentes |
| SuperAdmin | Un utilisateur ordinaire ne peut pas se promouvoir ; accès refusé sans AAL2 |
| Suspension | En `read_only`, toute écriture métier est refusée par la base |
| Webhooks | Signature invalide, rejeu, montant/devise incohérents : rejet |
| Uploads | Faux type MIME, SVG, fichier surdimensionné : refus |
| Boutique | Énumération de commandes, spam, injection de prix côté client : rejet |
| Authentification | Tentatives répétées : limitation effective |
| Secrets | Aucune clé privée dans le bundle ni dans le dépôt |

## 12. Sauvegarde et continuité

- Production sur un plan offrant la restauration à un instant donné (à vérifier à la création du projet), complétée par des exports chiffrés réguliers.
- Procédure de restauration documentée et **testée en préproduction** avant lancement.
- Registre des incidents ; plan de continuité (contacts, responsabilités, délais).

## 13. Conformité

Politique de confidentialité, conditions d'utilisation, politique de conservation et procédure de traitement des demandes d'accès/suppression (`data_requests`). Les obligations applicables au Sénégal (protection des données personnelles, transactions électroniques, facturation/TVA) sont à **valider par un juriste et un comptable** avant la mise en production.
