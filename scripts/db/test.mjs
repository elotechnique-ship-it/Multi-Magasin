#!/usr/bin/env node
// Lance les tests pgTAP (db/tests/*.test.sql) via psql sur une base de TEST LOCALE.
//   TEST_DATABASE_URL=postgres://postgres:...@127.0.0.1:5433/commerce_test node scripts/db/test.mjs
// Le compte doit être superutilisateur (création de l'extension pgTAP et changement de rôle). Chaque test s'exécute
// dans une transaction annulée (rollback) : rien n'est conservé. Refuse toute base non locale.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runPsql } from "./psql.mjs";
import { fileURLToPath } from "node:url";
import { describeTarget } from "../../lib/db/migration-plan.ts";
import { parseTap } from "../../lib/db/tap.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fail = (m) => { console.error(`db:test : ${m}`); process.exit(1); };

const url = process.env.TEST_DATABASE_URL;
if (!url) fail("variable TEST_DATABASE_URL absente");
const info = describeTarget(url);
if (!["localhost", "127.0.0.1", "::1", "[::1]", "db"].includes(info.host)) fail(`hôte non local refusé (${info.host}) : les tests ne s'exécutent que sur une base locale jetable`);
if (!/(^|_)(test|ci)(_|$)/i.test(info.database)) fail(`la base « ${info.database} » doit contenir « test » ou « ci » dans son nom`);

const dir = join(root, "db/tests");
const prelude = join(dir, "_prelude.sql");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.sql")).sort();
if (files.length === 0) fail("aucun test trouvé");

let totalPassed = 0;
let allOk = true;
for (const f of files) {
  // Le SQL (préambule + test) est envoyé par l'entrée standard : indépendant des chemins Windows et du conteneur.
  const sql = readFileSync(prelude, "utf8") + "\n" + readFileSync(join(dir, f), "utf8");
  let r;
  try {
    r = runPsql({ url, args: ["-q", "-t", "-A", "-f", "-"], input: sql, cwd: root, capture: true });
  } catch (e) {
    fail(e.message);
  }
  if (r.error) fail(`psql inaccessible (${r.error.code}) : Docker Desktop est-il démarré ?`);
  const tap = parseTap(r.stdout ?? "");
  totalPassed += tap.passed;
  const status = r.status === 0 && tap.ok ? "✓" : "✗";
  console.log(`${status} ${f} : ${tap.passed} réussies, ${tap.failed} échouées (plan : ${tap.planned ?? "absent"})`);
  if (r.status !== 0 || !tap.ok) {
    allOk = false;
    tap.failures.forEach((x) => console.log(`    ✗ ${x}`));
    if (r.status !== 0) console.log(`    erreur psql :\n${(r.stderr ?? "").split("\n").slice(0, 8).map((l) => "      " + l).join("\n")}`);
  }
}
console.log(allOk ? `db:test : OK — ${totalPassed} assertions` : "db:test : ÉCHEC");
process.exit(allOk ? 0 : 1);
