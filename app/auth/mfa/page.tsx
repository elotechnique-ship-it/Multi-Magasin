import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { sanitizeNext } from "@/lib/security/redirect";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = sanitizeNext(next, "/superadmin/dashboard");
  await requireUser(`/auth/mfa?next=${encodeURIComponent(safeNext)}`);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <MfaForm next={safeNext} />
    </main>
  );
}
