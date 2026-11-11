import "server-only";
import { z } from "zod";

// Secrets : serveur uniquement. Ce module échoue au build s'il est importé côté client.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
});

export function getServerEnv() {
  return serverSchema.parse({ SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY });
}
