#!/usr/bin/env node
// Contrôles STATIQUES des migrations (aucune base requise). Ne remplace pas pgTAP : il bloque les erreurs
// de conception évidentes avant même d'ouvrir une base. Échec = code de sortie 1.
//
// Règles :
//  R1 nom de fichier conforme            R5 SECURITY DEFINER => SET search_path dans l'en-tête
//  R2 RLS activée + forcée par table     R6 fonction publique => GRANT EXECUTE explicite
//  R3 aucune opération destructive       R7 aucun GRANT à anon (sauf marqueur approuvé)
//  R4 jamais de désactivation de RLS     R8 syntaxe : $$ et parenthèses équilibrés
//  R9 schéma auth : droits réservés à app_auth   R10 aucune création de rôle ni mot de passe dans les migrations
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../db/migrations/", import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const errors = [];
const fail = (file, rule, msg) => errors.push(`[${rule}] ${file} : ${msg}`);

const stripComments = (sql) => sql.replace(/--[^\n]*/g, "");
const stripStrings = (sql) => sql.replace(/'(?:[^']|'')*'/g, "''");

const all = files.map((f) => ({ name: f, raw: readFileSync(join(DIR, f), "utf8") }));
all.forEach((f) => (f.sql = stripComments(f.raw)));

// R1
for (const f of all) {
  if (!/^\d{14}_phase\d+_[a-z0-9_]+\.sql$/.test(f.name)) fail(f.name, "R1", "nom attendu : YYYYMMDDHHMMSS_phaseN_description.sql");
}
const stamps = all.map((f) => f.name.slice(0, 14));
if (new Set(stamps).size !== stamps.length) errors.push("[R1] horodatages de migration en double");

// R2 : toute table créée doit avoir la RLS activée ET forcée (explicitement, ou via la boucle de la migration RLS)
const tables = new Set();
for (const f of all) {
  for (const m of f.sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:[a-z_][a-z0-9_]*\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)) tables.add(m[1]);
}
for (const t of tables) {
  const explicit = (kind) =>
    all.some((f) => new RegExp(`alter\\s+table\\s+(?:[a-z_][a-z0-9_]*\\.)?"?${t}"?\\s+${kind}\\s+row\\s+level\\s+security`, "i").test(f.sql));
  const viaLoop = all.some(
    (f) =>
      /foreach\s+\w+\s+in\s+array/i.test(f.sql) &&
      /enable\s+row\s+level\s+security/i.test(f.sql) &&
      /force\s+row\s+level\s+security/i.test(f.sql) &&
      new RegExp(`'${t}'`).test(f.sql),
  );
  if (!(explicit("enable") && explicit("force")) && !viaLoop) fail("(toutes)", "R2", `table ${t} : RLS non activée et forcée`);
}

for (const f of all) {
  // R3 : opérations destructives interdites sans marqueur explicite approuvé
  const approved = /--\s*approved-destructive:\s*\S+/.test(f.raw);
  for (const stmt of f.sql.split(";")) {
    const s = stmt.trim();
    if (/^(drop\s+(table|schema|column|type|policy|trigger|function)|truncate\b|delete\s+from\b|alter\s+table\s+\S+\s+drop\s+column)/i.test(s) && !approved) {
      fail(f.name, "R3", `opération destructive sans marqueur « -- approved-destructive: <ticket> » : ${s.slice(0, 60)}…`);
    }
  }
  // R4 : jamais désactiver la sécurité
  if (/disable\s+row\s+level\s+security|no\s+force\s+row\s+level\s+security/i.test(f.sql)) fail(f.name, "R4", "désactivation de la RLS interdite");

  // R5 : SECURITY DEFINER => search_path fixé dans l'en-tête de la fonction
  for (const m of f.sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(([\s\S]*?)\$\$/gi)) {
    const header = m[0];
    if (/security\s+definer/i.test(header) && !/set\s+search_path\s*=/i.test(header)) fail(f.name, "R5", `${m[1]} : SECURITY DEFINER sans SET search_path`);
  }

  // R6 : fonction publique => GRANT EXECUTE explicite
  for (const m of f.sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
    const g = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${m[1]}\\s*\\(`, "i");
    if (!all.some((x) => g.test(x.sql))) fail(f.name, "R6", `public.${m[1]} : aucun GRANT EXECUTE explicite`);
  }

  // R7 : aucun droit pour app_public ni PUBLIC sans marqueur approuvé
  const publicApproved = /--\s*approved-public-grant:\s*\S+/.test(f.raw);
  for (const stmt of f.sql.split(";")) {
    if (/^\s*grant\b[\s\S]*\bto\b[^;]*\b(app_public|public)\b/i.test(stmt) && !publicApproved) {
      fail(f.name, "R7", "GRANT à app_public ou PUBLIC sans marqueur « -- approved-public-grant: <réf> »");
    }
  }

  // R9 : tout droit sur le schéma auth est réservé à app_auth
  for (const stmt of f.sql.split(";")) {
    if (/^\s*grant\b/i.test(stmt) && /\bauth\b/.test(stmt) && /\bto\b[^;]*\b(app_runtime|app_public|public|app_migrator)\b/i.test(stmt)) {
      fail(f.name, "R9", "droit sur le schéma auth accordé à un autre rôle qu'app_auth");
    }
  }

  // R10 : les rôles et mots de passe ne vivent QUE dans db/bootstrap (jamais dans une migration)
  if (/\b(create|alter|drop)\s+(role|user)\b/i.test(f.sql) || /\bpassword\s+'/i.test(f.sql)) {
    fail(f.name, "R10", "création/modification de rôle ou mot de passe dans une migration (réservé à db/bootstrap/roles.sql)");
  }

  // R8 : syntaxe grossière
  const dollars = (f.sql.match(/\$\$/g) || []).length;
  if (dollars % 2 !== 0) fail(f.name, "R8", "nombre impair de délimiteurs $$");
  const noStr = stripStrings(f.sql);
  const open = (noStr.match(/\(/g) || []).length;
  const close = (noStr.match(/\)/g) || []).length;
  if (open !== close) fail(f.name, "R8", `parenthèses déséquilibrées ( ${open} / ) ${close}`);
}

if (errors.length) {
  console.error(`check-migrations : ${errors.length} problème(s)\n` + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log(`check-migrations : OK — ${all.length} migrations, ${tables.size} tables (RLS activée+forcée), règles R1-R10 respectées`);
