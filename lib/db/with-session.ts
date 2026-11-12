import "server-only";
import { getPool } from "@/lib/db/pool";
import { runInSession, type SessionOptions, type TxClient } from "@/lib/db/session-tx";

/** Exécute `fn` dans une transaction liée à la session de l'utilisateur. Toute requête métier passe ici. */
export function withSession<T>(token: string, fn: (tx: TxClient) => Promise<T>, options?: SessionOptions): Promise<T> {
  return runInSession(getPool(), token, fn, options);
}
