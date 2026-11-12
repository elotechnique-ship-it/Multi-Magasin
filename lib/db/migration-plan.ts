// Logique PURE de l'exécuteur de migrations (aucun accès réseau ni base) : entièrement testable sans PostgreSQL.
// Utilisée par scripts/db/migrate.mjs et scripts/check-migrations.mjs.
import { createHash } from "node:crypto";

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  checksum: string;
}

export class MigrationError extends Error {}

export const MIGRATION_FILE_REGEX = /^(\d{14})_(phase\d+_[a-z0-9_]+)\.sql$/;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function parseMigrationFilename(filename: string): { version: string; name: string } | null {
  const m = MIGRATION_FILE_REGEX.exec(filename);
  if (!m || !m[1] || !m[2]) return null;
  return { version: m[1], name: m[2] };
}

export function buildMigrationFile(filename: string, sql: string): MigrationFile {
  const parsed = parseMigrationFilename(filename);
  if (!parsed) throw new MigrationError(`nom de migration invalide : ${filename}`);
  // Somme de contrôle calculée sur un texte aux fins de ligne normalisées : identique sous Windows (CRLF) et Linux (LF).
  return { ...parsed, sql, checksum: sha256Hex(sql.replace(/\r\n/g, "\n")) };
}

/**
 * Planifie les migrations à appliquer. Règles (toutes bloquantes) :
 *  - versions uniques ;
 *  - une migration déjà appliquée ne peut PAS avoir été modifiée (somme de contrôle) ;
 *  - une migration déjà appliquée ne peut PAS avoir disparu des fichiers ;
 *  - une nouvelle migration ne peut PAS être antérieure à la dernière appliquée (ordre strict, avant seulement).
 */
export function planMigrations(files: readonly MigrationFile[], applied: readonly AppliedMigration[]): MigrationFile[] {
  const sorted = [...files].sort((a, b) => a.version.localeCompare(b.version));
  const seen = new Set<string>();
  for (const f of sorted) {
    if (seen.has(f.version)) throw new MigrationError(`version en double : ${f.version}`);
    seen.add(f.version);
  }

  const byVersion = new Map(sorted.map((f) => [f.version, f]));
  for (const a of applied) {
    const f = byVersion.get(a.version);
    if (!f) throw new MigrationError(`migration appliquée absente des fichiers : ${a.version} (suppression interdite)`);
    if (f.checksum !== a.checksum) {
      throw new MigrationError(`migration ${a.version} modifiée après application (somme de contrôle différente) : créez une NOUVELLE migration`);
    }
  }

  const appliedVersions = new Set(applied.map((a) => a.version));
  const latestApplied = applied.map((a) => a.version).sort().at(-1) ?? "";
  const pending = sorted.filter((f) => !appliedVersions.has(f.version));
  for (const p of pending) {
    if (latestApplied && p.version < latestApplied) {
      throw new MigrationError(`migration ${p.version} antérieure à la dernière appliquée (${latestApplied}) : ordre strict exigé`);
    }
  }
  return pending;
}

/** Instructions destructives (sans le marqueur d'approbation explicite). */
export function findDestructiveStatements(sql: string): string[] {
  if (/--\s*approved-destructive:\s*\S+/.test(sql)) return [];
  const stripped = sql.replace(/--[^\n]*/g, "");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /^(drop\s+(table|schema|column|type|policy|trigger|function)|truncate\b|delete\s+from\b|alter\s+table\s+\S+\s+drop\s+column)/i.test(s))
    .map((s) => s.slice(0, 80));
}

export type MigrationTarget = "local" | "ci" | "staging" | "production";
export const TARGETS: readonly MigrationTarget[] = ["local", "ci", "staging", "production"];

export interface TargetInfo {
  host: string;
  port: string;
  database: string;
  user: string;
}

/** Décrit la cible SANS le mot de passe (pour l'affichage et les garde-fous). */
export function describeTarget(connectionString: string): TargetInfo {
  let u: URL;
  try {
    u = new URL(connectionString);
  } catch {
    throw new MigrationError("MIGRATION_DATABASE_URL invalide");
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new MigrationError("MIGRATION_DATABASE_URL doit commencer par postgres://");
  return { host: u.hostname, port: u.port || "5432", database: decodeURIComponent(u.pathname.replace(/^\//, "")), user: decodeURIComponent(u.username) };
}

/**
 * Garde-fous : le rôle de connexion doit être app_migrator (jamais un superutilisateur ni un rôle applicatif),
 * et la cible déclarée doit être cohérente avec l'hôte. Production : confirmation explicite obligatoire.
 */
export function assertSafeTarget(info: TargetInfo, target: MigrationTarget, opts: { confirmProduction: boolean }): void {
  if (info.user !== "app_migrator") {
    throw new MigrationError(`la connexion doit utiliser le rôle app_migrator (reçu : « ${info.user} »)`);
  }
  const isLocalHost = ["localhost", "127.0.0.1", "::1", "[::1]", "db"].includes(info.host);
  if ((target === "local" || target === "ci") && !isLocalHost) {
    throw new MigrationError(`cible « ${target} » mais hôte distant (${info.host}) : refusé`);
  }
  if ((target === "staging" || target === "production") && isLocalHost) {
    throw new MigrationError(`cible « ${target} » mais hôte local (${info.host}) : incohérent`);
  }
  if (target === "production" && !opts.confirmProduction) {
    throw new MigrationError("production : ajoutez --confirm-production (et disposez de l'autorisation écrite du maître d'ouvrage)");
  }
}
