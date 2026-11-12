import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { withSession } from "@/lib/db/with-session";
import { listMyStores } from "@/lib/db/queries/stores";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Mes magasins" };

export default async function StoreSelectorPage() {
  const { token } = await requireIdentity("/magasin");
  // Partir des adhésions de l'utilisateur : un administrateur plateforme (aal2) peut voir davantage de magasins qu'il n'en gère.
  const stores = await withSession(token, (tx) => listMyStores(tx), { readOnly: true });

  if (stores.length === 1 && stores[0]) redirect(`/magasin/${stores[0].slug}`);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Mes magasins</h1>
      {stores.length === 0 ? (
        <EmptyState
          title="Aucun magasin"
          description="Votre compte n’est rattaché à aucun magasin. Utilisez le lien d’invitation reçu par e-mail."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {stores.map((s) => (
            <li key={s.slug}>
              <Link href={`/magasin/${s.slug}`}>
                <Card className="flex min-h-14 items-center justify-between p-4 hover:bg-muted">
                  <span className="font-medium">{s.name}</span>
                  {s.status !== "active" ? <Badge tone="promo">{s.status === "suspended" ? "Suspendu" : "En attente"}</Badge> : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
