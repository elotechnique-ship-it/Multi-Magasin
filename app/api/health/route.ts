import { NextResponse } from "next/server";

// Sonde de disponibilité : aucune donnée, aucun accès base, aucun secret.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
