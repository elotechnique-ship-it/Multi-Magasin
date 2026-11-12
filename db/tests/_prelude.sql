-- Préambule des tests pgTAP : exécuté en tant que superutilisateur sur une base de TEST.
-- pgTAP est installé dans un schéma dédié pour ne pas polluer public (les tests contrôlent les droits de public).
create schema if not exists tap;
create extension if not exists pgtap schema tap;
grant usage on schema tap to public;
set search_path = public, tap;
