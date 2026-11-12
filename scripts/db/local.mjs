#!/usr/bin/env node
// Aide au développement LOCAL : base jetable Docker (docker-compose.yml). Identifiants factices, valables uniquement ici.
//   npm run db:local -- up | bootstrap | migrate | test | itest | all | down
// Fonctionne avec ou sans client psql installé (repli sur psql dans le conteneur Docker).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { hasHostPsql, runPsql } from "./psql.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const HOST = "127.0.0.1:5433";
const ADMIN = (db) => `postgres://postgres:local-superuser-only@${HOST}/${db}`;
const MIGRATOR = (db) => `postgres://app_migrator:local-migrator@${HOST}/${db}`;
const PW = ["-v", "migrator_password=local-migrator", "-v", "auth_password=local-auth", "-v", "runtime_password=local-runtime", "-v", "public_password=local-public"];

function fail(msg, code = 1) { console.error(`local : ${msg}`); process.exit(code); }

function run(cmd, args, env = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.error) fail(`commande introuvable : ${cmd} (${r.error.code}). Docker Desktop est-il installé et démarré ?`);
  if (r.status !== 0) fail(`échec de « ${cmd} »`, r.status ?? 1);
}

function psql(db, label, args, input) {
  console.log(`$ psql [${label}] base « ${db} »${hasHostPsql() ? "" : " (via Docker)"}`);
  const r = runPsql({ url: ADMIN(db), args, input, cwd: root });
  if (r.error) fail(`psql inaccessible : ${r.error.code}. Docker Desktop est-il démarré ?`);
  if (r.status !== 0) fail(`échec de psql [${label}]`, r.status ?? 1);
}

const bootstrap = (db) => psql(db, "roles.sql", [...PW, "-f", "-"], readFileSync(join(root, "db/bootstrap/roles.sql"), "utf8"));
const migrate = (db) => run("node", ["scripts/db/migrate.mjs", "--target", "local"], { MIGRATION_DATABASE_URL: MIGRATOR(db) });

// Base de test dédiée : pgTAP n'est jamais installé dans la base de développement.
// \gexec est une méta-commande psql : elle ne peut pas passer par « -c », d'où l'entrée standard.
function prepareTestDb() {
  psql("postgres", "création base de test", ["-q", "-f", "-"],
    "select 'create database commerce_test' where not exists (select 1 from pg_database where datname = 'commerce_test') \\gexec\n");
  bootstrap("commerce_test");
  migrate("commerce_test");
}

const cmd = process.argv[2];
switch (cmd) {
  case "up": run("docker", ["compose", "up", "-d", "--build", "--wait", "db"]); break;
  case "down": run("docker", ["compose", "down"]); break; // conserve le volume : aucune donnée supprimée
  case "bootstrap": bootstrap("commerce_dev"); break;
  case "migrate": migrate("commerce_dev"); break;
  case "test": prepareTestDb(); run("node", ["scripts/db/test.mjs"], { TEST_DATABASE_URL: ADMIN("commerce_test") }); break;
  case "itest": {
    // Tests d'intégration de la couche de données (Vitest) contre la base de test locale.
    prepareTestDb();
    run("node", ["node_modules/vitest/vitest.mjs", "run", "tests/integration"], {
      TEST_DATABASE_URL: ADMIN("commerce_test"),
      TEST_RUNTIME_DATABASE_URL: `postgres://app_runtime:local-runtime@${HOST}/commerce_test`,
    });
    break;
  }
  case "all": run("docker", ["compose", "up", "-d", "--build", "--wait", "db"]); bootstrap("commerce_dev"); migrate("commerce_dev"); break;
  default: fail("usage : npm run db:local -- up | bootstrap | migrate | test | itest | all | down");
}
