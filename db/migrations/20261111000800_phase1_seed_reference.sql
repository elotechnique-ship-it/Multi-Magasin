-- Phase 1B / 800 : données de RÉFÉRENCE (pas de données de test). Idempotent, additif.
-- Impact données existantes : aucun (insertions avec "where not exists" / "on conflict do nothing").

-- ───────── Permissions ─────────
insert into public.permissions (code, module_code, description) values
  ('products.view', 'products', 'Voir les produits'),
  ('products.create', 'products', 'Créer des produits'),
  ('products.update', 'products', 'Modifier des produits'),
  ('products.delete', 'products', 'Archiver des produits'),
  ('products.update_price', 'products', 'Modifier les prix de vente'),
  ('products.view_cost', 'products', 'Voir les prix d''achat'),
  ('stock.view', 'stock', 'Voir le stock'),
  ('stock.adjust', 'stock', 'Ajuster le stock'),
  ('stock.transfer', 'stock', 'Transférer du stock'),
  ('stock.count', 'stock', 'Réaliser un inventaire'),
  ('sales.create', 'sales', 'Créer des ventes'),
  ('sales.cancel', 'sales', 'Annuler des ventes'),
  ('sales.return', 'sales', 'Enregistrer des retours'),
  ('sales.discount', 'sales', 'Accorder des remises sans limite'),
  ('sales.discount_limited', 'sales', 'Accorder des remises limitées à un seuil'),
  ('sales.view', 'sales', 'Voir les ventes'),
  ('sales.view_profit', 'sales', 'Voir les marges'),
  ('cash.open', 'sales', 'Ouvrir une session de caisse'),
  ('cash.close', 'sales', 'Clôturer une session de caisse'),
  ('customers.view', 'customers', 'Voir les clients'),
  ('customers.manage', 'customers', 'Gérer les clients'),
  ('customers.manage_credit', 'customers', 'Gérer le crédit client'),
  ('suppliers.view', 'suppliers', 'Voir les fournisseurs'),
  ('suppliers.manage', 'suppliers', 'Gérer les fournisseurs'),
  ('purchases.manage', 'suppliers', 'Gérer les achats'),
  ('purchases.receive', 'suppliers', 'Réceptionner des achats'),
  ('finance.view', 'finance', 'Voir les finances'),
  ('finance.manage', 'finance', 'Gérer les finances'),
  ('reports.view', 'reports', 'Voir les rapports'),
  ('orders.view', 'orders', 'Voir les commandes en ligne'),
  ('orders.manage', 'orders', 'Gérer les commandes en ligne'),
  ('orders.deliver', 'orders', 'Mettre à jour les livraisons'),
  ('marketing.manage', 'marketing', 'Gérer le marketing'),
  ('users.manage', 'team', 'Gérer l''équipe'),
  ('settings.manage', 'settings', 'Gérer les paramètres du magasin'),
  ('billing.view', 'settings', 'Voir l''abonnement'),
  ('billing.manage', 'settings', 'Gérer l''abonnement'),
  ('audit.view', 'settings', 'Voir le journal d''audit'),
  ('locations.manage', 'settings', 'Gérer les points de vente')
on conflict (code) do nothing;

-- ───────── Rôles système ─────────
insert into public.roles (code, name, is_system)
select v.code, v.name, true
from (values
  ('owner', 'Propriétaire'),
  ('store_admin', 'Administrateur du magasin'),
  ('manager', 'Gérant'),
  ('cashier', 'Caissier'),
  ('stock_manager', 'Gestionnaire de stock'),
  ('accountant', 'Comptable'),
  ('salesperson', 'Vendeur'),
  ('delivery_agent', 'Livreur')
) as v(code, name)
where not exists (select 1 from public.roles r where r.store_id is null and r.code = v.code);

-- owner : toutes les permissions ; store_admin : toutes sauf billing.manage
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r cross join public.permissions p
where r.store_id is null and r.code = 'owner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r cross join public.permissions p
where r.store_id is null and r.code = 'store_admin' and p.code <> 'billing.manage'
on conflict do nothing;

-- Autres rôles : matrice de docs/security.md §2
insert into public.role_permissions (role_id, permission_code)
select r.id, perm
from (values
  ('manager', array[
    'products.view','products.create','products.update','products.delete','products.update_price','products.view_cost',
    'stock.view','stock.adjust','stock.transfer','stock.count',
    'sales.create','sales.cancel','sales.return','sales.discount','sales.view','sales.view_profit',
    'cash.open','cash.close','customers.view','customers.manage','customers.manage_credit',
    'suppliers.view','suppliers.manage','purchases.manage','purchases.receive',
    'finance.view','reports.view','orders.view','orders.manage','marketing.manage']),
  ('cashier', array[
    'products.view','stock.view','sales.create','sales.discount_limited','sales.view',
    'cash.open','cash.close','customers.view','customers.manage']),
  ('stock_manager', array[
    'products.view','products.create','products.update','products.view_cost',
    'stock.view','stock.adjust','stock.transfer','stock.count','purchases.receive','suppliers.view']),
  ('accountant', array[
    'products.view','products.view_cost','stock.view','sales.view','sales.view_profit',
    'finance.view','finance.manage','reports.view','suppliers.view']),
  ('salesperson', array[
    'products.view','stock.view','sales.create','sales.discount_limited','sales.view',
    'customers.view','customers.manage','orders.view','orders.manage']),
  ('delivery_agent', array['orders.view','orders.deliver'])
) as m(role_code, perms)
cross join lateral unnest(m.perms) as perm
join public.roles r on r.store_id is null and r.code = m.role_code
on conflict do nothing;

-- ───────── Modules (capacités) ─────────
insert into public.modules (code, name, description, is_core) values
  ('products', 'Produits', 'Catalogue produits', true),
  ('stock', 'Stock', 'Gestion du stock', true),
  ('sales', 'Ventes et caisse', 'Caisse et ventes', true),
  ('customers', 'Clients', 'Gestion des clients', true),
  ('suppliers', 'Fournisseurs et achats', 'Fournisseurs et approvisionnements', true),
  ('finance', 'Finances', 'Dépenses et trésorerie', true),
  ('orders', 'Commandes en ligne', 'Boutique et commandes', true),
  ('marketing', 'Marketing', 'Bannières et promotions', true),
  ('team', 'Équipe', 'Utilisateurs et rôles', true),
  ('settings', 'Paramètres', 'Paramètres du magasin', true),
  ('reports', 'Rapports', 'Rapports et statistiques', true),
  ('batches_expiry', 'Lots et péremption', 'Suivi des lots et dates de péremption', false),
  ('packagings', 'Conditionnements', 'Unités et conditionnements', false),
  ('variants', 'Variantes', 'Variantes (taille, couleur, nuance)', false),
  ('weight_sales', 'Vente au poids', 'Quantités décimales et pesée', false),
  ('serial_warranty', 'Numéros de série et garanties', 'Suivi par numéro de série', false),
  ('quotes', 'Devis', 'Devis et vente professionnelle', false),
  ('after_sales', 'Service après-vente', 'Tickets SAV', false),
  ('delivery_install', 'Livraison et installation', 'Livraison et installation', false),
  ('recipes_production', 'Recettes et production', 'Recettes et production', false),
  ('custom_orders', 'Commandes personnalisées', 'Commandes sur mesure', false),
  ('services_catalog', 'Catalogue de services', 'Prestations et opérateurs', false),
  ('loss_tracking', 'Suivi des pertes', 'Pertes et casse', false)
on conflict (code) do nothing;

-- ───────── Catégories (12) ─────────
insert into public.store_categories (code, name, sort_order) values
  ('alimentation', 'Alimentation', 1),
  ('quincaillerie', 'Quincaillerie', 2),
  ('multiservices', 'Multiservices', 3),
  ('cosmetique', 'Cosmétique', 4),
  ('electromenager', 'Électroménager', 5),
  ('epicerie', 'Épicerie', 6),
  ('boucherie_charcuterie', 'Boucherie-Charcuterie', 7),
  ('boulangerie_patisserie', 'Boulangerie-Pâtisserie', 8),
  ('librairie_papeterie', 'Librairie-Papeterie', 9),
  ('sport', 'Sport', 10),
  ('jouets', 'Jouets', 11),
  ('autres', 'Autres', 12)
on conflict (code) do nothing;

-- Modules par défaut de chaque catégorie : tous les modules cœur + capacités propres (docs/architecture.md §4.3)
insert into public.category_modules (category_id, module_code)
select c.id, m.code
from public.store_categories c cross join public.modules m
where m.is_core
on conflict do nothing;

insert into public.category_modules (category_id, module_code)
select c.id, v.module_code
from (values
  ('alimentation', 'batches_expiry'), ('alimentation', 'packagings'), ('alimentation', 'loss_tracking'),
  ('epicerie', 'batches_expiry'), ('epicerie', 'packagings'), ('epicerie', 'loss_tracking'),
  ('quincaillerie', 'packagings'), ('quincaillerie', 'quotes'),
  ('multiservices', 'services_catalog'),
  ('cosmetique', 'variants'), ('cosmetique', 'batches_expiry'),
  ('electromenager', 'serial_warranty'), ('electromenager', 'quotes'),
  ('electromenager', 'after_sales'), ('electromenager', 'delivery_install'),
  ('boucherie_charcuterie', 'weight_sales'), ('boucherie_charcuterie', 'batches_expiry'),
  ('boucherie_charcuterie', 'loss_tracking'),
  ('boulangerie_patisserie', 'recipes_production'), ('boulangerie_patisserie', 'custom_orders'),
  ('boulangerie_patisserie', 'loss_tracking'),
  ('sport', 'variants'),
  ('jouets', 'variants')
) as v(category_code, module_code)
join public.store_categories c on c.code = v.category_code
on conflict do nothing;

-- ───────── Plans : PLACEHOLDERS (décision D17 : prix et limites non définis) ─────────
-- Inactifs (is_active = false), prix à 0 : à renseigner par le SuperAdmin avant toute commercialisation.
insert into public.subscription_plans (code, name, price_minor, is_active, sort_order) values
  ('starter', 'Starter (à définir)', 0, false, 1),
  ('business', 'Business (à définir)', 0, false, 2),
  ('premium', 'Premium (à définir)', 0, false, 3),
  ('enterprise', 'Enterprise (à définir)', 0, false, 4)
on conflict (code) do nothing;
