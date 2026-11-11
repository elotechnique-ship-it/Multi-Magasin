// Mini-implémentation de l'API Vitest (describe/it/expect) utilisée UNIQUEMENT par run-unit-tests.mjs
// pour exécuter les vrais fichiers de test quand Vitest n'est pas installable (environnement sans réseau).
// En CI et en développement, c'est Vitest lui-même qui s'exécute (npm test).
import assert from "node:assert/strict";

export const registry = [];
let stack = [];

export function describe(name, fn) {
  stack.push(name);
  fn();
  stack.pop();
}
export function it(name, fn) {
  registry.push({ name: [...stack, name].join(" › "), fn });
}
export const test = it;

export function expect(actual) {
  return {
    toBe: (e) => assert.strictEqual(actual, e),
    toEqual: (e) => assert.deepStrictEqual(actual, e),
    toBeNull: () => assert.strictEqual(actual, null),
    toBeTruthy: () => assert.ok(actual),
    toMatch: (re) => assert.match(String(actual), re),
    toBeGreaterThanOrEqual: (n) => assert.ok(actual >= n, `${actual} < ${n}`),
    toThrow: (E) => assert.throws(actual, E),
  };
}
