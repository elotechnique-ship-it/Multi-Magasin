import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_CANDIDATES } from "@/lib/auth/constants";

const PROTECTED = ["/magasin", "/superadmin"];

// Redirection RAPIDE uniquement (le middleware ne peut pas interroger la base). Ce n'est PAS un contrôle d'accès :
// la présence d'un cookie ne prouve rien. La vérification réelle (session valide, droits, RLS) est faite par la base,
// dans les layouts serveur (requireIdentity / requireStoreAccess / requirePlatformAdmin).
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasCookie = SESSION_COOKIE_CANDIDATES.some((name) => request.cookies.get(name)?.value);

  if (isProtected && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/connexion";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
