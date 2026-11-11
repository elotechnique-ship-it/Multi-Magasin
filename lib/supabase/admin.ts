import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

/**
 * Client SERVICE ROLE : contourne la RLS. Usage strictement limité à :
 *   webhooks signés, invitations Auth (API admin), tâches planifiées, procédures d'administration.
 * Jamais pour répondre à une requête utilisateur ordinaire. Jamais importé depuis un composant client.
 */
export function createAdminClient() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
