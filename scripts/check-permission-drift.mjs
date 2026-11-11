#!/usr/bin/env node
// Garantit que le catalogue TypeScript des permissions et la table SQL public.permissions sont identiques,
// et que toute permission utilisée dans une politique, une fonction ou un menu existe réellement.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const errors = [];

// 1. Catalogue TypeScript
const ts = readFileSync(join(root, "lib/permissions/catalog.ts"), "utf8");
const tsBlock = /export const PERMISSIONS = \[([\s\S]*?)\] as const;/.exec(ts);
if (!tsBlock) throw new Error("catalogue TypeScript introuvable");
const tsSet = new Set([...tsBlock[1].matchAll(/"([a-z_]+\.[a-z_]+)"/g)].map((m) => m[1]));

// 2. Table SQL (migration de référence)
const migDir = join(root, "supabase/migrations");
const migs = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
const seedFile = migs.find((f) => f.includes("seed_reference"));
if (!seedFile) throw new Error("migration de données de référence introuvable");
const seed = readFileSync(join(migDir, seedFile), "utf8");
const permInsert = /insert into public\.permissions[\s\S]*?on conflict/i.exec(seed);
if (!permInsert) throw new Error("insertion des permissions introuvable");
const sqlSet = new Set([...permInsert[0].matchAll(/\(\s*'([a-z_]+\.[a-z_]+)'\s*,/g)].map((m) => m[1]));

for (const p of tsSet) if (!sqlSet.has(p)) errors.push(`permission « ${p} » présente en TypeScript mais absente de la table SQL`);
for (const p of sqlSet) if (!tsSet.has(p)) errors.push(`permission « ${p} » présente en SQL mais absente du catalogue TypeScript`);

// 3. Toute permission référencée dans les rôles, politiques et fonctions SQL existe
const reference = (text, where) => {
  for (const m of text.matchAll(/'([a-z_]+\.[a-z_]+)'/g)) {
    if (!sqlSet.has(m[1])) errors.push(`${where} : permission inconnue « ${m[1]} »`);
  }
};
const roleSection = seed.slice(seed.indexOf("-- owner : toutes"));
reference(roleSection, seedFile);
for (const f of migs) {
  if (f === seedFile) continue;
  const text = readFileSync(join(migDir, f), "utf8").replace(/--[^\n]*/g, "");
  for (const m of text.matchAll(/has_permission\([^)]*?'([^']+)'\s*\)/g)) {
    if (!sqlSet.has(m[1])) errors.push(`${f} : has_permission avec permission inconnue « ${m[1]} »`);
  }
}

// 4. Permissions référencées par le menu TypeScript
const registry = readFileSync(join(root, "lib/modules/registry.ts"), "utf8");
for (const m of registry.matchAll(/permission:\s*"([a-z_]+\.[a-z_]+)"/g)) {
  if (!tsSet.has(m[1])) errors.push(`registry.ts : permission inconnue « ${m[1]} »`);
}

if (errors.length) {
  console.error(`check-permission-drift : ${errors.length} problème(s)\n` + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log(`check-permission-drift : OK — ${tsSet.size} permissions identiques en TypeScript et SQL, toutes les références valides`);
