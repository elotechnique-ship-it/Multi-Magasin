import type { Metadata } from "next";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Tableau de bord SuperAdmin" };

export default function SuperAdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Magasins actifs" value="—" hint="Phase 2" />
        <KpiCard label="Abonnements en retard" value="—" hint="Phase 2" />
        <KpiCard label="Revenus du mois" value="—" hint="Phase 2" />
        <KpiCard label="Tickets ouverts" value="—" hint="Phase 2" />
      </section>
      <EmptyState title="Administration de la plateforme" description="La gestion des magasins, abonnements et paiements arrive en Phase 2." />
    </div>
  );
}
