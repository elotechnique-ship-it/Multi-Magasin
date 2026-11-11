# Commerce SaaS : plateforme de gestion commerciale multi-magasins

**Direction retenue : option B (Railway seul, sans Supabase)**, voir `docs/option-b-plan.md` (plan en attente de validation).
Le code actuel correspond à l'option A (Supabase) et sert de base de référence ; il sera adapté par lots B0 à B6.

## Prérequis

- Node.js ≥ 22 (≥ 20.9 minimum pour Next.js)
- Docker (pour Supabase en local)
- Supabase CLI (installée par `npm install` via la dépendance de développement, ou séparément)

## Mise en route (développement local uniquement)

```bash
npm install                      # génère package-lock.json : à COMMITER (fige les versions)
cp .env.example .env.local       # puis renseigner avec les valeurs affichées par `supabase start`
npx supabase start               # base locale éphémère : aucune donnée réelle
npm run dev
```

> Ne jamais exécuter `supabase db reset`, `supabase link` ou `supabase db push` contre un projet distant sans autorisation écrite. Un `reset` est toléré **uniquement** sur la base locale de développement ou de CI.

## Procédure de validation de la Phase 1

À exécuter dans cet ordre ; chaque commande doit réussir. Joindre la sortie complète au rapport.

| # | Commande | Ce qu'elle prouve |
|---|---|---|
| 1 | `npm run check:static` | Règles SQL (RLS, destructif, search_path, anon), cohérence permissions TS/SQL, absence de secrets, jetons de design, 35 tests purs |
| 2 | `npx supabase start` | Les 8 migrations s'appliquent sur une base vierge |
| 3 | `npx supabase db lint --fail-on error` | Aucune erreur de lint SQL |
| 4 | `npx supabase test db` | Tests pgTAP : socle de sécurité (001) et isolation inter-magasins, rôles, MFA, invitations, journaux (002) |
| 5 | `npm run typecheck` | Types stricts avec les vraies dépendances |
| 6 | `npm run lint` | ESLint (dont interdiction d'importer les modules serveur) |
| 7 | `npm test` | Tests unitaires Vitest |
| 8 | `npm run build` | Compilation de production |
| 9 | `npm run test:e2e` | Redirections d'authentification, en-têtes de sécurité, sonde de santé |

## Déploiement

Railway (application) + Supabase (base, auth, stockage) : voir `docs/deployment-railway.md`. Préproduction uniquement tant que la Phase 1 n'est pas validée.

## Structure

Voir `docs/architecture.md`. Points clés :

- `supabase/migrations` : schéma versionné, **additif uniquement**.
- `supabase/tests` : tests pgTAP (RLS et sécurité).
- `lib/supabase/admin.ts` : seul module autorisé à utiliser la clé service role (`server-only`).
- `scripts/` : contrôles statiques exécutés aussi en CI ; `scripts/admin/` : procédures manuelles d'administration.

## Règles de protection

Voir `docs/00-decisions.md` §1.
