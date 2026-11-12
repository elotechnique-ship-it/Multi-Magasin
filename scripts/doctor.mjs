#!/usr/bin/env node
// Diagnostic de l'environnement : dossier, version du code, Node, Docker, dossiers parents. Lecture seule.
//   npm run doctor
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const errors = [];
const warns = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const ko = (m, fix) => { errors.push(m); console.log(`  ✗ ${m}${fix ? `\n      → ${fix}` : ""}`); };
const warn = (m, fix) => { warns.push(m); console.log(`  ! ${m}${fix ? `\n      → ${fix}` : ""}`); };

console.log(`Projet : ${root}\n`);

// 1. Dossier de lancement
const from = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : null;
if (from && resolve(root) !== from) {
  warn(`vous avez lancé la commande depuis un sous-dossier (${from})`, `les commandes « node scripts/... » doivent être lancées depuis ${resolve(root)} : cd "${resolve(root)}"`);
} else ok("lancé depuis la racine du projet");

// 2. Node
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj > 22 || (maj === 22 && min >= 18)) ok(`Node ${process.versions.node} (≥ 22.18 requis)`);
else ko(`Node ${process.versions.node} trop ancien`, "installez Node.js 22.18 ou plus (LTS) : https://nodejs.org");

// 3. Version du code
const migs = readdirSync(join(root, "db/migrations")).filter((f) => f.endsWith(".sql")).length;
const legacy = existsSync(join(root, "lib/supabase"));
const hasB2 = existsSync(join(root, "lib/db/with-session.ts"));
if (legacy) ko("ancienne version du projet détectée (le dossier lib/supabase existe)", "retéléchargez le dernier zip et décompressez-le dans un NOUVEAU dossier vide");
else if (!hasB2) ko("la couche d'accès aux données (lot B2) est absente", "retéléchargez le dernier zip");
else ok(`version à jour : lot B2 présent, ${migs} migrations`);
if (!JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts["test:integration"]) ko("script test:integration absent : version obsolète", "retéléchargez le dernier zip");

// 4. Dossiers parents (copies imbriquées, configurations qui interfèrent)
let dir = dirname(resolve(root));
const seen = [];
for (let i = 0; i < 6; i++) {
  for (const f of [".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs", "package.json", "next.config.ts", "tsconfig.json"]) {
    if (existsSync(join(dir, f))) seen.push(join(dir, f));
  }
  const up = dirname(dir);
  if (up === dir) break;
  dir = up;
}
if (seen.length) warn(`fichiers de projet dans un dossier PARENT : ${seen.join(", ")}`, "vous avez sans doute deux copies imbriquées du projet : n'en gardez qu'une, dans un dossier dont les parents ne contiennent aucun fichier de projet");
else ok("aucun fichier de projet dans les dossiers parents");

// 5. node_modules
if (existsSync(join(root, "node_modules"))) ok("dépendances installées"); else ko("dépendances absentes", "npm install");

// 6. Docker (nécessaire pour la base locale et les tests de sécurité)
const d = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 20000 });
if (d.error) ko("Docker introuvable", "installez Docker Desktop : https://www.docker.com/products/docker-desktop");
else if (d.status !== 0) ko("Docker est installé mais son moteur ne répond pas", "démarrez Docker Desktop et attendez « Engine running » (icône verte), puis relancez");
else ok(`Docker prêt (moteur ${d.stdout.trim()})`);

// 7. psql (facultatif)
const p = spawnSync("psql", ["--version"], { encoding: "utf8" });
if (p.status === 0) ok("client psql présent"); else console.log("  - client psql absent : sans importance (utilisé dans le conteneur Docker)");

console.log(errors.length ? `\nRÉSULTAT : ${errors.length} problème(s) bloquant(s)` : warns.length ? `\nRÉSULTAT : prêt, avec ${warns.length} avertissement(s)` : "\nRÉSULTAT : tout est prêt");
process.exit(errors.length ? 1 : 0);
