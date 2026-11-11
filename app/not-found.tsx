import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { fr } from "@/lib/i18n/fr";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <EmptyState
        title={fr.notFound.title}
        description={fr.notFound.description}
        action={<Link href="/"><Button variant="secondary">{fr.notFound.home}</Button></Link>}
      />
    </main>
  );
}
