import type { Metadata } from "next";
import { requireStoreAccess } from "@/lib/auth/store-access";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function StoreDashboardPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const { store } = await requireStoreAccess(storeSlug);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{store.name}</h1>
      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ventes du jour" value="—" hint="Disponible avec la caisse (Phase 3)" />
        <KpiCard label="Produits" value="—" hint="Disponible avec le catalogue (Phase 3)" />
        <KpiCard label="Stock faible" value="—" hint="Disponible avec la gestion du stock (Phase 3)" />
        <KpiCard label="Commandes en ligne" value="—" hint="Disponible avec la boutique (Phase 5)" />
      </section>
      <EmptyState
        title="Votre espace est prêt"
        description="Les modules de gestion (produits, stock, caisse) seront activés dans les prochaines phases."
      />
    </div>
  );
}
