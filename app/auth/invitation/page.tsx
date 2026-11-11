import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  // L’utilisateur doit être connecté avec le compte invité (compte créé par invitation Auth).
  await requireUser(token ? `/auth/invitation?token=${encodeURIComponent(token)}` : "/auth/invitation");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <InvitationForm token={token ?? ""} />
    </main>
  );
}
