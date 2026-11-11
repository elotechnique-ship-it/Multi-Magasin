# Déploiement et exploitation

> Aucun déploiement n'a été effectué. Ce document décrit la procédure cible ; chaque étape touchant la préproduction ou la production exige une autorisation écrite.

## 1. Environnements

| Environnement | Base | Données | Qui peut y appliquer des migrations |
|---|---|---|---|
| Local | Supabase CLI (Docker) | fictives, jetables | développeur |
| CI | Supabase local éphémère | fictives, détruites en fin de job | automatique |
| Préproduction | Projet Supabase distinct | fictives | après revue, sur demande |
| Production | Projet Supabase dédié | réelles | **uniquement après autorisation écrite** |

## 2. Variables d'environnement (noms uniquement)

| Variable | Portée | Remarque |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | publique | URL canonique du site (utilisée pour les redirections d'authentification) |
| `NEXT_PUBLIC_SUPABASE_URL` | publique | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publique | Clé anon : sans danger si la RLS est correcte |
| `SUPABASE_SERVICE_ROLE_KEY` | **secrète, serveur** | Contourne la RLS. Jamais dans Git, le navigateur, les journaux ni une conversation. Rotation documentée. |

Les secrets de prestataires de paiement (Phase 7) s'ajouteront ici, par nom, dans la même catégorie.

## 3. Réglages Supabase à appliquer par projet (Auth)

À vérifier dans le tableau de bord et à comparer à `supabase/config.toml` :

- Inscription publique désactivée (D4) ; création de comptes par invitation (API admin).
- Longueur minimale de mot de passe : 12.
- Confirmation d'e-mail activée ; rotation des refresh tokens activée.
- MFA TOTP activée (enrôlement et vérification).
- Limitation de débit des routes d'authentification ; **CAPTCHA à activer** (voir `phase1-report.md`, élément ouvert).
- URL de redirection autorisées : uniquement le domaine du site.

## 4. Procédure de migration (cible)

1. Revue de la migration (objectif, tables, impact données, retour arrière).
2. CI verte (`check:static`, pgTAP, lint SQL).
3. Application en préproduction ; vérification ; tests de non-régression.
4. **Autorisation écrite** du maître d'ouvrage.
5. Application en production, hors heures de pointe, avec sauvegarde récente confirmée.
6. Aucune opération destructive sans marqueur `-- approved-destructive: <référence>` et validation explicite.

## 5. Sauvegarde et restauration

À définir à la création du projet de production (plan Supabase offrant la restauration à un instant donné, exports chiffrés complémentaires). Une restauration doit être **testée en préproduction** avant le lancement (Phase 9).

## 6. Création du premier SuperAdmin

Procédure manuelle `scripts/admin/create-platform-admin.sql` (compte créé au préalable par invitation). L'administrateur enrôle la MFA à sa première connexion ; sans session AAL2 il n'a aucun droit de plateforme.

## 7. Journal de déploiement

| Date | Environnement | Version | Opérateur | Autorisation |
|---|---|---|---|---|
| (aucun déploiement à ce jour) | | | | |
