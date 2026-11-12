#!/usr/bin/env node
// Détection de secrets et de fuites serveur -> client. Complète gitleaks (CI) par des règles propres au projet.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage", "playwright-report", "test-results"]);
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|sql|md|yml|yaml|toml|css|example)$/;
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);
const SELF = "scripts/check-secrets.mjs";
// DATABASE_URL (rôle app_runtime) : seul lib/env.server.ts la lit dans le code ; ailleurs, uniquement outillage et documentation.
const DATABASE_URL_ALLOWED = [/^lib\/env\.server\.ts$/, /^lib\/db\/(pool|runtime-url)\.ts$/, /^docs\//, /^scripts\//, /^\.github\//, /^README\.md$/, /^\.env\.example$/, /^tests\//];
// Identifiants de base : MIGRATION_DATABASE_URL (rôle app_migrator, BYPASSRLS) ne doit exister que dans les outils d'exploitation.
const MIGRATOR_ALLOWED = [/^scripts\//, /^docs\//, /^\.github\//, /^README\.md$/, /^\.env\.example$/, /^lib\/db\/(migration-plan|runtime-url)\.ts$/, /^tests\/unit\//];

for (const abs of files) {
  const rel = relative(root, abs).split(sep).join("/"); // séparateurs normalisés (Windows)

  // Aucun fichier .env réel dans le dépôt
  if (/(^|\/)\.env(\.[a-z]+)?$/.test(rel) && rel !== ".env.example") errors.push(`${rel} : fichier d'environnement réel présent (interdit)`);
  if (!TEXT_EXT.test(rel) && rel !== ".env.example") continue;
  if (rel === SELF) continue;
  const text = readFileSync(abs, "utf8");

  // Motifs de secrets
  if (/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(text)) errors.push(`${rel} : jeton JWT en clair`);
  if (/sk_(live|test)_[A-Za-z0-9]{10,}/.test(text)) errors.push(`${rel} : clé secrète de type sk_*`);
  if (/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(text)) errors.push(`${rel} : clé privée`);
  if (/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PRIVATE)[A-Z_]*/.test(text)) errors.push(`${rel} : variable NEXT_PUBLIC_ au nom de secret (serait exposée au navigateur)`);

  // DATABASE_URL (rôle app_runtime) : lue uniquement par lib/env.server.ts ; jamais exposée au navigateur
  if (/(^|[^A-Z_])DATABASE_URL\b/.test(text) && !DATABASE_URL_ALLOWED.some((re) => re.test(rel))) {
    errors.push(`${rel} : référence à DATABASE_URL hors de lib/env.server.ts`);
  }

  // Le rôle migrateur ne doit JAMAIS être référencé par le code applicatif (app/, lib/, components/, middleware)
  if (/MIGRATION_DATABASE_URL|app_migrator/.test(text) && !MIGRATOR_ALLOWED.some((re) => re.test(rel)) && !/^db\//.test(rel)) {
    errors.push(`${rel} : référence au rôle migrateur hors des outils d'exploitation`);
  }
  // URL de connexion avec mot de passe en clair
  if (/postgres(ql)?:\/\/[^\s:@\/]+:(?!\*|\.\.\.|x@|secret@|\$|%|<|\{)[^\s@\/]{6,}@/.test(text) && !/^(scripts\/db\/local\.mjs|docker-compose\.yml|tests\/unit\/|docs\/|README\.md)/.test(rel)) {
    errors.push(`${rel} : URL de connexion PostgreSQL avec mot de passe en clair`);
  }

  // Fichiers « use client » : aucun import de module serveur
  if (/\.(ts|tsx)$/.test(rel)) {
    const head = text.replace(/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "");
    if (/^["']use client["']/.test(head)) {
      for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        if (/env\.server|^server-only$|lib\/db\/|^pg$|^next\/headers$/.test(m[1])) {
          errors.push(`${rel} : composant client important un module serveur (« ${m[1]} »)`);
        }
      }
    }
  }
}

// Modules serveur : doivent importer server-only (échec de build s'ils sont importés côté client)
for (const f of ["lib/env.server.ts", "lib/db/pool.ts", "lib/db/with-session.ts", "lib/auth/current-session.ts"]) {
  const text = readFileSync(join(root, f), "utf8");
  if (!/import\s+["']server-only["']/.test(text)) errors.push(`${f} : doit importer "server-only"`);
}

if (errors.length) {
  console.error(`check-secrets : ${errors.length} problème(s)\n` + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log(`check-secrets : OK — ${files.length} fichiers analysés, aucun secret, aucune fuite serveur → client`);
