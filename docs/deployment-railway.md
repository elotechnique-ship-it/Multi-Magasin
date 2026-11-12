# Déploiement sur Railway (option B)

**Portée : PRÉPRODUCTION, données fictives uniquement.** La production réelle exige : lot B5 terminé (sauvegardes testées), porte 3 franchie et autorisation écrite.

## Ce qui peut être déployé aujourd'hui

| Élément | État |
|---|---|
| **Base PostgreSQL** (rôles, 9 migrations, référentiels) | **Déployable maintenant** (procédure A ci-dessous) |
| **Application Next.js** | **Pas encore** : le code utilise encore Supabase (lot B2) et n'a pas d'authentification (lot B3). Procédure B ci-dessous, pour plus tard |

## Procédure A : base PostgreSQL de préproduction (une commande)

**GitHub et la base sont deux choses différentes.** Pousser le projet sur GitHub (GitHub Desktop) ne crée rien dans la base Railway : le dépôt sert à l'application, la base se prépare avec la commande ci-dessous. Vérifications GitHub : le dépôt est **privé**, `package.json` est visible **à la racine** du dépôt, et aucun fichier `.env` n'y figure. Côté Railway, le service **Multi-Magasin** doit rester **en pause** (une publication sur GitHub déclenche sinon une construction).

**Prérequis :** Docker Desktop démarré, `npm install` fait, base Railway **neuve et séparée** (celle de BinkMedicab et BinkResto n'est PAS concernée : la commande refuse toute base qui contient déjà des tables).

### A1. Ouvrir temporairement l'accès externe
Service Postgres **neuf** > *Settings* > *Networking* > *Public Access*. Dans l'onglet *Variables* du même service, copiez la valeur de `DATABASE_PUBLIC_URL`.

### A2. Vérifier la cible (lecture seule)
Dans PowerShell, dans le dossier du projet :
```powershell
$env:ADMIN_DATABASE_URL = Read-Host "Collez DATABASE_PUBLIC_URL"
node scripts/db/remote.mjs check
```
Résultat attendu : `✓ base vierge et conforme`, avec PostgreSQL 15 ou plus, `superutilisateur : oui`, `tables existantes : 0`. Sinon la base est **refusée** et rien n'est modifié.

### A3. Préparer la base
```powershell
node scripts/db/remote.mjs setup --yes
```
La commande crée les 4 rôles, applique les 10 migrations, puis vérifie que `app_runtime` voit 0 magasin sans session et ne peut pas lire le schéma `auth`. **Les 4 mots de passe sont affichés une seule fois** : copiez-les aussitôt dans un gestionnaire de mots de passe (ils ne sont écrits nulle part).

### A4. Refermer l'accès externe
Retirez le *Public Access* du service Postgres. La base redevient privée.

### Limites
- La connexion des migrations est **chiffrée mais sans vérification du certificat** (le proxy Railway est auto-signé) : acceptable pour de la préproduction fictive, **interdit pour la production** (le script le refuse hors `--target staging`).
- Les tests pgTAP ne s'exécutent pas sur Railway (le lanceur refuse toute base distante).
- Aucune sauvegarde n'est configurée : pas de données réelles avant le lot B5.
- Si le script échoue après la création des rôles, **ne relancez pas `setup`** (il refuserait : les rôles existent) : envoyez-moi la sortie complète.

## Procédure B : l'application, depuis GitHub (test d'infrastructure)

**Ce que cette étape donne aujourd'hui :** un site qui se construit, démarre et répond, **sans connexion possible** (l'authentification est le lot B3). Elle valide la chaîne GitHub, Railway, sonde de santé et variables ; elle n'apporte pas de fonctionnalité. Elle consomme du crédit Railway en continu.

### B1. Préparer GitHub (GitHub Desktop)
1. Le dépôt est **privé**. Sur github.com, `package.json` est visible **à la racine** (sinon Railway ne trouve pas le projet).
2. Dans GitHub Desktop, la branche courante est `option-b`. Les fichiers modifiés comprennent `package-lock.json` (généré par `npm install` : il **fige** les versions, il doit être commité). `tsconfig.tsbuildinfo` ne doit pas apparaître (ignoré).
3. *Commit to option-b* (message : « Fige les dépendances »), puis *Push origin*.
4. Vérifier sur github.com, branche `option-b` : `package-lock.json`, `railway.json` et `.node-version` sont présents.

### B2. Créer le service sur Railway
Idéalement dans un **projet Railway séparé** de BinkMedicab et BinkResto. Si vous restez dans le même projet : le nouveau service ne doit référencer **aucune** variable des autres services, et vous ne cliquez jamais sur le raccourci « connecter une base de données » proposé en violet.
1. *New* > *GitHub Repo* > choisir le dépôt.
2. Service > *Settings* > *Source* : **branche `option-b`**, *Root Directory* vide.
3. Service > *Variables*, **avant le premier build** :

| Variable | Valeur | Remarque |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://exemple.up.railway.app` (provisoire) | **Exigée** par le code ; intégrée au build, donc à corriger après l'étape B3 puis redéployer |

Rien d'autre n'est nécessaire à ce stade. **Ne pas** ajouter de variable Supabase (obsolètes), ni `MIGRATION_DATABASE_URL`, ni la variable `DATABASE_URL` fournie par le service PostgreSQL de Railway (c'est le **superutilisateur** : l'application refuse de l'utiliser et s'arrêtera avec un message explicite).

### B3. Domaine, puis redéploiement
1. Service > *Settings* > *Networking* > *Generate Domain*.
2. Remplacer `NEXT_PUBLIC_SITE_URL` par `https://<domaine généré>`, puis redéployer (la valeur est figée au moment du build).

### B4. Vérifier (PowerShell)
```powershell
Invoke-RestMethod https://<domaine>/api/health          # doit afficher : status ok
curl.exe -I https://<domaine>/                          # doit montrer 200 et les en-têtes de sécurité
curl.exe -I https://<domaine>/magasin                   # doit rediriger vers /auth/connexion
```
Dans le navigateur : la page d'accueil s'affiche ; `/auth/connexion` montre le formulaire ; toute tentative de connexion répond que **l'authentification n'est pas encore disponible** (comportement attendu avant B3).

### B5. Relier la base (plus tard, utile seulement après B3)
Après `node scripts/db/remote.mjs setup --yes`, ajouter la variable :
`DATABASE_URL=postgres://app_runtime:<mot-de-passe>@<hôte privé du service Postgres>:5432/<base>`
L'hôte privé et le nom de base se copient depuis l'onglet *Variables* du service PostgreSQL (valeurs `RAILWAY_PRIVATE_DOMAIN` et `PGDATABASE`). **Le mot de passe est celui du rôle `app_runtime`, affiché une seule fois par `setup`.** N'utilisez jamais l'adresse publique pour l'application.

### En cas d'échec de construction
Service > *Deployments* > le déploiement en échec > *Build Logs* : copiez les 40 dernières lignes à partir de la première occurrence de « Error », après avoir vérifié qu'aucun secret n'y figure.

## Retour arrière
- **Application** : redéployer la version précédente depuis Railway.
- **Base** : nouvelle migration corrective. Aucune suppression ni réinitialisation d'une base distante.
