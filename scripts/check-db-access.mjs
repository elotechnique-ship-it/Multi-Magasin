#!/usr/bin/env node
// Garantit que TOUT accès à la base passe par la couche lib/db (withSession). Règles :
//  D1 le pilote « pg » n'est importé que par lib/db/pool.ts (et l'outillage : scripts/, tests/)
//  D2 le pool n'est importé que par lib/db/with-session.ts
//  D3 « new Pool( » n'existe que dans lib/db/pool.ts
//  D4 le code applicatif ne référence JAMAIS les tables du schéma auth (identité : public.my_identity())
//  D5 requêtes SQL paramétrées : aucune interpolation « ${...} » dans un gabarit SQL de lib/db/queries
//  D6 seul lib/db/session-tx.ts fixe app.session_token
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const SKIP = new Set(["node_modules", ".next", ".git", "coverage", "playwright-report", "test-results"]);
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

const isTooling = (rel) => /^(scripts|tests)\//.test(rel);
const isDbLayer = (rel) => /^lib\/db\//.test(rel);

for (const abs of walk(root)) {
  const rel = relative(root, abs).split(sep).join("/");
  const text = readFileSync(abs, "utf8");

  // D1
  if (/from\s+["']pg["']|require\(\s*["']pg["']\s*\)|import\(\s*["']pg["']\s*\)/.test(text) && rel !== "lib/db/pool.ts" && !isTooling(rel)) {
    errors.push(`[D1] ${rel} : import du pilote « pg » hors de lib/db/pool.ts`);
  }
  // D2
  if (/from\s+["'](@\/lib\/db\/pool|\.\/pool|\.\.\/db\/pool)["']/.test(text) && rel !== "lib/db/with-session.ts" && !isTooling(rel)) {
    errors.push(`[D2] ${rel} : import du pool hors de lib/db/with-session.ts (utilisez withSession)`);
  }
  // D3
  if (/new\s+Pool\s*\(/.test(text) && rel !== "lib/db/pool.ts" && !isTooling(rel)) {
    errors.push(`[D3] ${rel} : « new Pool » hors de lib/db/pool.ts`);
  }
  // D4
  if (!isDbLayer(rel) && !isTooling(rel) && /(\bfrom|\bjoin)\s+auth\.|\bauth\."?(user|session|account|verification|twoFactor|rateLimit)\b/.test(text)) {
    errors.push(`[D4] ${rel} : référence au schéma auth (utilisez public.my_identity())`);
  }
  // D5
  if (/^lib\/db\/queries\//.test(rel)) {
    for (const m of text.matchAll(/`([^`]*)`/g)) {
      if (m[1].includes("${")) errors.push(`[D5] ${rel} : interpolation dans un gabarit SQL (utilisez des paramètres $1, $2…)`);
    }
  }
  // D6
  if (/app\.session_token/.test(text) && rel !== "lib/db/session-tx.ts" && !isTooling(rel) && !/\.sql$/.test(rel)) {
    errors.push(`[D6] ${rel} : app.session_token ne se fixe que dans lib/db/session-tx.ts`);
  }
}

if (errors.length) {
  console.error(`check-db-access : ${errors.length} problème(s)\n` + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log("check-db-access : OK — tout accès à la base passe par lib/db (D1 à D6)");
