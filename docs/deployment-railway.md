# Déploiement sur Railway (option B)

**Portée : PRÉPRODUCTION, données fictives uniquement.** La production réelle exige : lot B5 terminé (sauvegardes testées), porte 3 franchie et autorisation écrite.

## Ce qui peut être déployé aujourd'hui

| Élément | État |
|---|---|
| **Base PostgreSQL** (rôles, 9 migrations, référentiels) | **Déployable maintenant** (procédure A ci-dessous) |
| **Application Next.js** | **Pas encore** : le code utilise encore Supabase (lot B2) et n'a pas d'authentification (lot B3). Procédure B ci-dessous, pour plus tard |

## Procédure A : base PostgreSQL de préproduction

**Avant de commencer (recommandé) :** avoir réussi `npm run db:test` en local (porte 1). Sinon, vous faites la première exécution des migrations sur un serveur distant. C'est acceptable en préproduction, mais une erreur se corrige plus vite en local.

Prérequis sur votre poste : Node ≥ 22.18, `npm install` fait, client `psql`.

### A1. Créer la base sur Railway
1. Nouveau projet Railway, puis *Add* > *Database* > **PostgreSQL**.
2. Vérifier la version : l'accès au serveur étant décrit ci-dessous, lancer `select version();`. **PostgreSQL 15 ou plus est obligatoire** (contrainte `UNIQUE NULLS NOT DISTINCT`). Si la version est plus ancienne, arrêtez-vous et dites-le-moi.
3. La base est **privée par défaut** : aucune action pour l'instant.

### A2. Ouvrir temporairement l'accès externe
Service PostgreSQL > *Settings* > *Networking* > *Public Access*. Cela crée un proxy TCP et remplit la variable `DATABASE_PUBLIC_URL`. Le trafic sortant est facturé : ne laissez pas l'accès ouvert plus longtemps que nécessaire.

Dans votre terminal (ne collez jamais cette URL dans une conversation) :
```bash
export ADMIN_DATABASE_URL="<valeur de DATABASE_PUBLIC_URL, avec ?sslmode=require>"
psql "$ADMIN_DATABASE_URL" -c "select version();"
psql "$ADMIN_DATABASE_URL" -c "select rolsuper from pg_roles where rolname = current_user;"   # doit afficher t
```

### A3. Créer les quatre rôles applicatifs
Générer quatre mots de passe forts, **à ranger dans un gestionnaire de mots de passe** (sans caractères `/ + = @ :` pour éviter l'encodage d'URL) :
```bash
openssl rand -base64 32 | tr -d '/+=' | cut -c1-32     # à répéter 4 fois
```
Puis, une seule fois :
```bash
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v migrator_password='…' -v auth_password='…' -v runtime_password='…' -v public_password='…' \
  -f db/bootstrap/roles.sql
```

### A4. Appliquer les migrations
Remplacer hôte et port par ceux de `ADMIN_DATABASE_URL` ; la base s'appelle par défaut `railway`.
```bash
export MIGRATION_DATABASE_URL="postgres://app_migrator:<mot-de-passe-migrateur>@<hôte-proxy>:<port>/railway?sslmode=require"
node scripts/db/migrate.mjs --target staging --dry-run    # affiche le plan, ne modifie rien
node scripts/db/migrate.mjs --target staging              # applique les 9 migrations
```
Le script refuse tout rôle autre que `app_migrator`, refuse un hôte local pour `staging`, n'a aucune option de retour arrière ni de réinitialisation, et annule une migration entière si elle échoue.

### A5. Vérifier
```bash
# en tant que rôle applicatif : sans session valide, aucune donnée visible ; schéma auth inaccessible
psql "postgres://app_runtime:<mdp-runtime>@<hôte-proxy>:<port>/railway?sslmode=require" \
  -c "select count(*) from public.stores;" \
  -c "select * from auth.\"user\";"
```
Attendu : `0` pour la première requête ; **`permission denied for schema auth`** pour la seconde. Envoyez-moi ces deux sorties : elles remplacent, pour l'essentiel, les tests pgTAP que Railway ne peut pas exécuter.

### A6. Refermer l'accès externe
Service PostgreSQL > *Networking* > supprimer le *Public Access*. La base redevient privée.

### Limites de la procédure A
- Les tests pgTAP **ne s'exécutent pas** sur Railway (le lanceur refuse toute base distante). Ils restent un contrôle local et de CI.
- **Aucune sauvegarde n'est configurée** : pas de données réelles avant le lot B5.
- Une migration appliquée ne se modifie jamais : un correctif est une **nouvelle** migration.

## Procédure B : application (à faire après les lots B2 et B3)

À compléter lors du lot B5. Points déjà établis :

1. Service applicatif créé depuis un dépôt GitHub **privé** (le fichier `railway.json` configure démarrage, sonde `/api/health` et redémarrage).
2. **Piège à éviter :** la variable `DATABASE_URL` fournie par Railway pour PostgreSQL contient les identifiants du **superutilisateur**. **Ne jamais la référencer depuis l'application.** Le code de l'application **refuse de démarrer** si `DATABASE_URL` n'utilise pas le rôle `app_runtime` (garde-fou du lot B2). Définir à la place, dans le service applicatif, une variable `DATABASE_URL` dont l'URL utilise le rôle voulu et l'adresse privée du service (`<service>.railway.internal:5432`) :
   - `DATABASE_URL` : rôle `app_runtime`
   - `AUTH_DATABASE_URL` : rôle `app_auth`
3. `MIGRATION_DATABASE_URL` ne doit **jamais** être définie sur le service applicatif.
4. Variables Supabase (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`) : **supprimées**, à retirer du service Railway s'il en a encore. Seules `NEXT_PUBLIC_SITE_URL` et `DATABASE_URL` sont lues par le code actuel (B3 ajoutera `AUTH_DATABASE_URL` et `BETTER_AUTH_SECRET`).
5. Les migrations s'appliquent depuis un poste d'opérateur ou la CI, jamais au démarrage de l'application.

## Retour arrière
- **Application** : redéployer la version précédente depuis Railway.
- **Base** : nouvelle migration corrective. Aucune suppression ni réinitialisation d'une base distante.
