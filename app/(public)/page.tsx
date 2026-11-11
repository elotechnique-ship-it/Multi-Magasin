import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Gérez vos magasins en toute sécurité</h1>
      <p className="text-muted-foreground">Caisse, stock, clients et boutique en ligne pour les commerçants.</p>
      <Link href="/auth/connexion"><Button size="lg">Se connecter</Button></Link>
    </main>
  );
}
