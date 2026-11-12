import "server-only";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env.server";

declare global {
  // eslint-disable-next-line no-var
  var __commercePool: Pool | undefined;
}

/** Pool unique (rôle app_runtime). Réservé à lib/db : aucune requête métier ne doit l'utiliser directement. */
export function getPool(): Pool {
  if (!globalThis.__commercePool) {
    const pool = new Pool({
      connectionString: getServerEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
      idle_in_transaction_session_timeout: 15_000,
      application_name: "commerce-app",
    });
    pool.on("error", (err: Error) => console.error("[db] erreur sur une connexion inactive :", err.message));
    globalThis.__commercePool = pool;
  }
  return globalThis.__commercePool;
}
