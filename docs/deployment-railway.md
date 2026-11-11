# Déploiement sur Railway (préproduction)

> **Document caduc pour l'option B.** Il décrit l'option A (Railway + Supabase) et sera réécrit au lot B5 de `option-b-plan.md`. Ne pas l'exécuter tant que le plan B n'est pas validé : il crée un projet Supabase.


**Portée autorisée :** environnement de **préproduction**, avec un projet Supabase **neuf**. La production réelle et le projet Supabase existant (Gate A) ne sont **pas** concernés.

## Ce que Railway héberge, et ce qu'il n'héberge pas

| Élément | Hébergé par |
|---|---|
| Application Next.js | **Railway** |
| Base PostgreSQL, authentification, stockage | **Supabase** (projet séparé) |

Railway ne remplace pas Supabase : il faut **les deux**.

## Avertissement avant de commencer

La Phase 1 n'est **pas validée** : les migrations et les tests pgTAP n'ont jamais été exécutés. Déployer maintenant revient à faire cette première exécution sur un environnement distant. C'est acceptable en préproduction avec des données fictives, **à condition** de suivre l'ordre ci-dessous. Ce qui sera déployé n'est que la Phase 1 : connexion, double authentification, tableaux de bord vides. **Il n'existe pas encore d'écran de création de magasin** (Phase 2) ; le script `scripts/admin/staging-bootstrap.sql` la remplace en attendant.

## Étapes (dans cet ordre)

### 0. Recommandé : valider en local d'abord (environ 15 minutes)
Au minimum les étapes 1 à 4 du `README.md` (`check:static`, `supabase start`, `db lint`, `supabase test db`). Si un test échoue en local, il échouera aussi en distant, mais en plus vous aurez écrit dans une base hébergée.

### 1. Figer les dépendances
```bash
npm install        # génère package-lock.json
git add package-lock.json && git commit -m "Fige les dépendances"
```
Sans fichier de verrouillage, Railway installe les dernières versions autorisées à chaque build : résultat non reproductible.

### 2. Créer un projet Supabase NEUF de préproduction
- Nouveau projet, nom explicite (ex. `commerce-staging`). **Pas** le projet existant.
- Région : proche de Railway et des utilisateurs (Europe de l'Ouest probable) ; à choisir maintenant, elle ne se change pas ensuite.
- Noter, sans les partager : l'URL du projet, la clé `anon`, la référence du projet. La clé `service_role` n'est **pas** nécessaire en Phase 1 : ne la renseignez pas sur Railway (moindre privilège).

### 3. Appliquer les migrations sur le projet de préproduction
```bash
npx supabase login
npx supabase link --project-ref <REF_DU_PROJET_STAGING>
npx supabase db push
```
Vérifiez que `link` pointe bien sur le projet de **préproduction** avant `db push`. Les 8 migrations ajoutent des objets et ne suppriment rien. N'utilisez **jamais** `supabase db reset` sur un projet distant.

### 4. Régler l'authentification (Supabase > Authentication)
| Réglage | Valeur |
|---|---|
| Inscription publique (sign-ups) | **Désactivée** |
| Longueur minimale du mot de passe | 12 |
| Confirmation d'e-mail | Activée |
| MFA TOTP | Activée |
| Site URL | `https://<domaine-railway>` (après l'étape 6) |
| Redirect URLs | `https://<domaine-railway>/auth/callback` uniquement |
| CAPTCHA | À activer dès disponible (élément ouvert) |

### 5. Créer Railway : projet et variables
1. Nouveau projet Railway > *Deploy from GitHub repo* (le code doit être dans un dépôt GitHub **privé**).
2. Variables du service :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase de préproduction |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` du projet de préproduction |
| `NEXT_PUBLIC_SITE_URL` | `https://<domaine-railway>` (voir étape 6) |

Les variables `NEXT_PUBLIC_*` sont **intégrées au code au moment du build** : toute modification exige un nouveau déploiement.

### 6. Domaine, puis redéploiement
1. Service > *Settings* > *Networking* > générer un domaine.
2. Renseigner `NEXT_PUBLIC_SITE_URL` avec ce domaine, puis redéployer.
3. Reporter ce domaine dans Supabase (étape 4 : Site URL et Redirect URLs).

`railway.json` configure déjà la commande de démarrage, la sonde de santé `/api/health` et le redémarrage automatique.

### 7. Premier SuperAdmin et magasin de démonstration
1. Supabase > Authentication > *Add user* (invitation) : créer votre compte administrateur ; ouvrir le lien reçu pour définir le mot de passe.
2. Promouvoir ce compte : `scripts/admin/create-platform-admin.sql` (via psql ou SQL Editor du projet de **préproduction**).
3. Créer un magasin fictif pour tester : `scripts/admin/staging-bootstrap.sql` (compte propriétaire déjà existant).

### 8. Vérifications après déploiement
```bash
curl -s https://<domaine>/api/health                       # {"status":"ok"}
curl -sI https://<domaine>/magasin | head -5               # redirection vers /auth/connexion
curl -sI https://<domaine>/ | grep -i -E "x-frame|x-content-type|strict-transport|referrer"
```
Puis à la main : connexion, enrôlement MFA du SuperAdmin, accès à `/superadmin/dashboard`, connexion du propriétaire de démonstration et accès à `/magasin/<slug>`, accès refusé (404) à un magasin dont on n'est pas membre. Envoyez-moi les résultats : je les compare au rapport de Phase 1.

## Retour arrière
- **Application** : Railway > *Deployments* > redéployer la version précédente.
- **Base** : les migrations sont additives ; un retour arrière se fait par une **nouvelle migration**, jamais par suppression ou réinitialisation.

## Points de vigilance
- Sur un domaine `*.up.railway.app`, l'en-tête HSTS est appliqué mais sans effet de préchargement ; à réévaluer avec un domaine propre.
- La CSP est en mode **Report-Only** : elle n'est pas encore bloquante.
- Aucun mécanisme de sauvegarde n'est configuré : les données de préproduction sont jetables.
- La production réelle nécessitera : domaine propre, plan Supabase avec restauration ponctuelle, CAPTCHA, validation complète de la Phase 1, et votre **autorisation écrite**.
