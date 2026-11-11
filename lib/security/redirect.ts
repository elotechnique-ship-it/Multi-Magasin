// Protection contre la redirection ouverte (open redirect) : seul un chemin interne est accepté.
const BASE = "http://internal.invalid";

export function sanitizeNext(next: string | null | undefined, fallback = "/magasin"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
