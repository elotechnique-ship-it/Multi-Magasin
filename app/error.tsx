"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { fr } from "@/lib/i18n/fr";

// Message générique : aucun détail interne n'est affiché à l'utilisateur.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <ErrorState title={fr.error.title} action={<Button onClick={reset}>{fr.error.retry}</Button>} />
    </main>
  );
}
