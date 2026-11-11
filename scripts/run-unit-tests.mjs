#!/usr/bin/env node
// Exécute tests/unit/*.test.ts SANS Vitest ni dépendances (Node >= 22 retire les types nativement).
import { register } from "node:module";
import { readdirSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join } from "node:path";

register("./loader.mjs", import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const dir = join(root, "tests/unit");
const { registry } = await import("./vitest-shim.mjs");

for (const f of readdirSync(dir).filter((x) => x.endsWith(".test.ts")).sort()) {
  await import(pathToFileURL(join(dir, f)).href);
}

let passed = 0;
const failed = [];
for (const t of registry) {
  try {
    await t.fn();
    passed++;
  } catch (e) {
    failed.push(`${t.name}\n     ${String(e.message).split("\n").slice(0, 4).join("\n     ")}`);
  }
}
console.log(`run-unit-tests : ${passed}/${registry.length} tests réussis`);
if (failed.length) {
  console.error(failed.map((f) => " ✗ " + f).join("\n"));
  process.exit(1);
}
