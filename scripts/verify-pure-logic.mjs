#!/usr/bin/env node
// Cohérence entre fichiers qui doivent rester synchronisés : CSS <-> jetons TS, TS <-> contrainte SQL des slugs,
// variables Tailwind <-> variables CSS définies.
import { register } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

register("./loader.mjs", import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const errors = [];

const { COLOR_TOKENS, REQUIRED_AA_PAIRS } = await import(pathToFileURL(join(root, "lib/design/tokens.ts")).href);
const { contrastRatio } = await import(pathToFileURL(join(root, "lib/design/contrast.ts")).href);
const { SLUG_REGEX, RESERVED_SLUGS } = await import(pathToFileURL(join(root, "lib/validation/slug.ts")).href);

// 1. CSS <-> jetons TS
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const cssVars = Object.fromEntries([...css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2].toUpperCase()]));
for (const [k, v] of Object.entries(COLOR_TOKENS)) {
  if (cssVars[k] !== v.toUpperCase()) errors.push(`jeton ${k} : TS=${v} CSS=${cssVars[k] ?? "absent"}`);
}

// 2. Contrastes (affichage + contrôle)
const lines = [];
for (const [fg, bg, label] of REQUIRED_AA_PAIRS) {
  const r = contrastRatio(COLOR_TOKENS[fg], COLOR_TOKENS[bg]);
  lines.push(`   ${r.toFixed(2).padStart(5)}:1  ${label}`);
  if (r < 4.5) errors.push(`contraste insuffisant (${r.toFixed(2)}:1) : ${label}`);
}

// 3. Slugs : TS <-> contrainte SQL
const stores = readFileSync(join(root, "supabase/migrations", readdirSync(join(root, "supabase/migrations")).find((f) => f.includes("stores"))), "utf8");
const sqlRegex = /slug\s+~\s+'([^']+)'/.exec(stores)?.[1];
if (sqlRegex !== SLUG_REGEX.source) errors.push(`regex de slug différente : SQL=${sqlRegex} TS=${SLUG_REGEX.source}`);
const sqlReserved = /slug\s+not\s+in\s+\(([^)]+)\)/.exec(stores)?.[1].match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
if ([...sqlReserved].sort().join() !== [...RESERVED_SLUGS].sort().join()) errors.push(`slugs réservés différents : SQL=[${sqlReserved}] TS=[${RESERVED_SLUGS}]`);

// 4. Toute variable CSS utilisée dans Tailwind ou dans les composants est définie
const used = new Set();
for (const f of ["tailwind.config.ts", "components/layout/app-shell.tsx"]) {
  for (const m of readFileSync(join(root, f), "utf8").matchAll(/var\((--[a-z0-9-]+)\)/g)) used.add(m[1]);
}
const definedAll = new Set([...css.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
for (const v of used) if (!definedAll.has(v)) errors.push(`variable CSS utilisée mais non définie : ${v}`);

if (errors.length) {
  console.error(`verify-pure-logic : ${errors.length} problème(s)\n` + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log(`verify-pure-logic : OK — jetons CSS/TS identiques, slugs TS/SQL identiques, ${used.size} variables CSS résolues\n` + lines.join("\n"));
