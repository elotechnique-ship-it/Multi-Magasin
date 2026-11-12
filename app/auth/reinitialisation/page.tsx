import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

// Le lien de réinitialisation sera à usage unique et indépendant d'une session (lot B3).
export default function ResetPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <ResetForm />
    </main>
  );
}
