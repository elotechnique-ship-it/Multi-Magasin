// Garde-fous PURS de la préparation d'une base distante (Railway de préproduction). Aucun accès réseau : testables sans base.
export class RemoteGuardError extends Error {}

export interface AdminTarget {
  url: string; // URL avec sslmode=require (pour psql)
  host: string;
  port: string;
  database: string;
  user: string;
}

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]", "db"];

/** Analyse l'URL du superutilisateur de la base distante. Refuse tout ce qui n'est pas une base distante. */
export function parseAdminUrl(raw: string): AdminTarget {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new RemoteGuardError("ADMIN_DATABASE_URL n'est pas une URL valide (collez la valeur de DATABASE_PUBLIC_URL)");
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new RemoteGuardError("l'URL doit commencer par postgres:// ou postgresql://");
  if (LOCAL_HOSTS.includes(u.hostname.toLowerCase())) {
    throw new RemoteGuardError("hôte local : cette commande prépare une base DISTANTE. Pour la base locale, utilisez npm run db:local");
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database) throw new RemoteGuardError("nom de base absent de l'URL");
  if (u.searchParams.get("sslmode") !== "verify-full") u.searchParams.set("sslmode", "require");
  return { url: u.toString(), host: u.hostname, port: u.port || "5432", database, user: decodeURIComponent(u.username) };
}

/** URL d'un rôle applicatif sur la même base. Le mot de passe doit être sûr pour une URL (alphabet base64url). */
export function buildRoleUrl(t: AdminTarget, role: string, password: string): string {
  if (!/^app_(migrator|auth|runtime|public)$/.test(role)) throw new RemoteGuardError(`rôle inattendu : ${role}`);
  if (!/^[A-Za-z0-9_-]{24,}$/.test(password)) throw new RemoteGuardError("mot de passe invalide (24 caractères minimum, alphabet A-Z a-z 0-9 _ -)");
  return `postgres://${role}:${password}@${t.host}:${t.port}/${encodeURIComponent(t.database)}?sslmode=require`;
}

/** Mot de passe aléatoire (alphabet base64url, 32 caractères). Le générateur aléatoire est injecté pour les tests. */
export function generatePassword(rng: (n: number) => Uint8Array): string {
  const bytes = rng(24);
  if (bytes.length !== 24) throw new RemoteGuardError("générateur aléatoire invalide");
  return Buffer.from(bytes).toString("base64url");
}

export interface Inspection {
  version: number; // server_version_num, ex. 160004
  isSuperuser: boolean;
  userTables: number; // tables hors catalogues système
  appRoles: number; // app_migrator, app_auth, app_runtime, app_public déjà présents
  reservedSchemas: number; // schémas auth / private déjà présents
}

/** Liste des raisons de REFUSER la préparation (vide = base vierge et conforme). */
export function assertFreshDatabase(i: Inspection): string[] {
  const problems: string[] = [];
  const major = Math.floor(i.version / 10000);
  if (major < 15) problems.push(`PostgreSQL 15 ou plus est obligatoire (version détectée : ${major})`);
  if (!i.isSuperuser) problems.push("le compte fourni n'est pas superutilisateur (nécessaire pour créer les rôles)");
  if (i.userTables > 0) {
    problems.push(`la base contient déjà ${i.userTables} table(s) : REFUSÉ (elle sert probablement une autre application)`);
  }
  if (i.appRoles > 0) problems.push(`${i.appRoles} rôle(s) app_* existent déjà : les mots de passe seraient inconnus, ne pas relancer`);
  if (i.reservedSchemas > 0) problems.push("les schémas auth ou private existent déjà : la base n'est pas vierge");
  return problems;
}
