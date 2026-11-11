import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPage() {
  await requireUser("/auth/reinitialisation");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <ResetForm />
    </main>
  );
}
