// Hooks de résolution Node : "vitest" -> shim ; "@/..." -> racine du projet (.ts / index.ts).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const shim = pathToFileURL(join(root, "scripts/vitest-shim.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "vitest") return { url: shim, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = join(root, specifier.slice(2));
    for (const cand of [`${base}.ts`, join(base, "index.ts"), `${base}.tsx`]) {
      if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
