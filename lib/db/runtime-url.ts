// Garde-fou : l'application ne se connecte JAMAIS avec un autre rôle que app_runtime.
// (Piège Railway : la variable DATABASE_URL fournie par le service PostgreSQL contient le SUPERUTILISATEUR.)
export class RuntimeUrlError extends Error {}

export function parseRuntimeDatabaseUrl(value: string | undefined): string {
  if (!value) throw new RuntimeUrlError("DATABASE_URL absente");
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new RuntimeUrlError("DATABASE_URL invalide");
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new RuntimeUrlError("DATABASE_URL doit commencer par postgres://");
  const user = decodeURIComponent(u.username);
  if (user !== "app_runtime") {
    throw new RuntimeUrlError(
      `DATABASE_URL doit utiliser le rôle app_runtime (reçu : « ${user || "(vide)"} »). Ne jamais utiliser le superutilisateur, app_migrator ou app_auth pour l'application.`,
    );
  }
  return value;
}
