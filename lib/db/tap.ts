// Analyse de la sortie TAP produite par pgTAP (via psql). Pure : testable sans base.
export interface TapResult {
  passed: number;
  failed: number;
  failures: string[];
  planned: number | null;
  ok: boolean;
}

export function parseTap(output: string): TapResult {
  let passed = 0;
  let failed = 0;
  let planned: number | null = null;
  const failures: string[] = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const bad = /^not ok\s+(\d+)\s*(?:-\s*(.*))?$/.exec(line);
    if (bad) {
      failed++;
      failures.push(`#${bad[1]} ${bad[2] ?? ""}`.trim());
      continue;
    }
    if (/^ok\s+\d+/.test(line)) {
      passed++;
      continue;
    }
    const plan = /^1\.\.(\d+)$/.exec(line);
    if (plan && plan[1]) planned = Number(plan[1]);
  }
  // Un test sans aucune assertion, ou un plan différent du nombre d'assertions exécutées, est un échec.
  const consistent = planned !== null && planned === passed + failed && passed + failed > 0;
  return { passed, failed, failures, planned, ok: failed === 0 && consistent };
}
