import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sanitizeNext } from "@/lib/security/redirect";

// Échange du code (réinitialisation de mot de passe, lien magique). La base de redirection est
// l’URL du site configurée, jamais l’en-tête Host de la requête.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = sanitizeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, publicEnv.NEXT_PUBLIC_SITE_URL));
  }
  return NextResponse.redirect(new URL("/auth/connexion", publicEnv.NEXT_PUBLIC_SITE_URL));
}
