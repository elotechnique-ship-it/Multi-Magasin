import "server-only";
import { parseRuntimeDatabaseUrl } from "@/lib/db/runtime-url";

// Secrets : serveur uniquement. Ce module échoue au build s'il est importé côté client.
export function getServerEnv() {
  return { DATABASE_URL: parseRuntimeDatabaseUrl(process.env.DATABASE_URL) };
}
