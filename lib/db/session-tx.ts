// Transaction « sous session » : LE point d'entrée de toute requête métier (variante B-2, voir docs/b0-decision-note.md).
// Le jeton de session est fixé dans la transaction ; la base retrouve elle-même l'utilisateur (auth.session).
// Module PUR (aucune dépendance) : testable sans base de données.

export interface TxClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface PooledConnection extends TxClient {
  release(destroy?: boolean): void;
}
export interface ConnectionSource {
  connect(): Promise<PooledConnection>;
}

export class InvalidSessionTokenError extends Error {}

/** Jeton : ASCII imprimable sans espace, 1 à 512 caractères. (Le jeton est TOUJOURS passé en paramètre, jamais concaténé.) */
export function assertSessionToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || token.length < 1 || token.length > 512 || !/^[\x21-\x7e]+$/.test(token)) {
    throw new InvalidSessionTokenError("jeton de session invalide");
  }
}

export interface SessionOptions {
  /** Transaction en lecture seule : la base refuse toute écriture. À privilégier pour les pages. */
  readOnly?: boolean;
}

export async function runInSession<T>(
  source: ConnectionSource,
  token: string,
  fn: (tx: TxClient) => Promise<T>,
  options: SessionOptions = {},
): Promise<T> {
  assertSessionToken(token);
  const conn = await source.connect();
  let destroy = false;
  try {
    await conn.query(options.readOnly ? "begin read only" : "begin");
    // set_config(..., true) : valable pour CETTE transaction seulement => sûr avec un pool de connexions.
    await conn.query("select set_config('app.session_token', $1, true)", [token]);
    // On ne transmet qu'une façade : la fonction appelante ne peut ni libérer la connexion ni sortir de la transaction.
    const tx: TxClient = { query: (text, params) => conn.query(text, params) };
    const result = await fn(tx);
    await conn.query("commit");
    return result;
  } catch (error) {
    try {
      await conn.query("rollback");
    } catch {
      destroy = true; // état incertain : la connexion est détruite plutôt que réutilisée
    }
    throw error;
  } finally {
    conn.release(destroy);
  }
}
