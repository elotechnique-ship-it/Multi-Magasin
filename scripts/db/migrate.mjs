#!/usr/bin/env node
// Exécuteur de migrations : SQL pur, AVANT SEULEMENT (jamais de retour arrière ni de réinitialisation).
//   MIGRATION_DATABASE_URL=postgres://app_migrator:...@hôte:port/base node scripts/db/migrate.mjs --target <local|ci|staging|production> [--dry-run] [--offline-plan] [--confirm-production]
// Nécessite Node >= 22.18 (exécution native de TypeScript). Dépendance : « pg ».
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeTarget, buildMigrationFile, describeTarget, findDestructiveStatements, MigrationError, planMigrations, TARGETS,
} from "../../lib/db/migration-plan.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const has = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const fail = (msg) => { console.error(`migrate : ${msg}`); process.exit(1); };

// Commandes dangereuses : explicitement refusées.
for (const bad of ["--reset", "--down", "--rollback", "--drop", "--force", "--baseline"]) {
  if (has(bad)) fail(`l'option ${bad} n'existe pas : ce projet n'autorise ni retour arrière, ni réinitialisation. Un correctif se fait par une NOUVELLE migration.`);
}

const target = val("--target");
if (!TARGETS.includes(target)) fail(`--target requis parmi : ${TARGETS.join(", ")}`);

const dir = join(root, "db/migrations");
let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => buildMigrationFile(f, readFileSync(join(dir, f), "utf8")));
} catch (e) {
  fail(e instanceof MigrationError ? e.message : `lecture des migrations impossible : ${e.message}`);
}

function checkDestructive(pending) {
  for (const m of pending) {
    const d = findDestructiveStatements(m.sql);
    if (d.length) fail(`${m.version}_${m.name} contient des opérations destructives sans marqueur « -- approved-destructive: <référence> » : ${d.join(" | ")}`);
  }
}

// Mode hors ligne : valide les fichiers sans toucher à aucune base.
if (has("--offline-plan")) {
  const pending = planMigrations(files, []);
  checkDestructive(pending);
  console.log(`migrate (hors ligne) : ${pending.length} migration(s) valides, dans l'ordre :`);
  for (const m of pending) console.log(`  ${m.version}_${m.name}  sha256:${m.checksum.slice(0, 12)}`);
  process.exit(0);
}

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) fail("variable MIGRATION_DATABASE_URL absente");
let info;
try {
  info = describeTarget(url);
  assertSafeTarget(info, target, { confirmProduction: has("--confirm-production") });
} catch (e) {
  fail(e instanceof MigrationError ? e.message : String(e));
}
console.log(`migrate : cible « ${target} » → ${info.user}@${info.host}:${info.port}/${info.database}`);

let pg;
try {
  pg = (await import("pg")).default;
} catch {
  fail("dépendance « pg » absente : exécutez npm install");
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const LOCK = 727274;
try {
  await client.query("select pg_advisory_lock($1)", [LOCK]);
  await client.query("create schema if not exists private");
  await client.query(`create table if not exists private.schema_migrations (
    version text primary key, name text not null, checksum text not null,
    applied_at timestamptz not null default now(), applied_by text not null default current_user)`);
  const { rows } = await client.query("select version, checksum from private.schema_migrations order by version");
  const pending = planMigrations(files, rows);
  checkDestructive(pending);

  if (pending.length === 0) {
    console.log("migrate : base à jour, rien à appliquer.");
  } else {
    console.log(`migrate : ${pending.length} migration(s) à appliquer :`);
    for (const m of pending) console.log(`  ${m.version}_${m.name}`);
  }
  if (has("--dry-run")) {
    console.log("migrate : --dry-run, rien n'a été appliqué.");
  } else {
    for (const m of pending) {
      await client.query("begin");
      try {
        await client.query(m.sql);
        await client.query("insert into private.schema_migrations (version, name, checksum) values ($1, $2, $3)", [m.version, m.name, m.checksum]);
        await client.query("commit");
        console.log(`  ✓ ${m.version}_${m.name}`);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`échec de ${m.version}_${m.name} (annulée, base inchangée pour cette migration) : ${e.message}`);
      }
    }
  }
} catch (e) {
  console.error(`migrate : ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => {});
  await client.end();
}
