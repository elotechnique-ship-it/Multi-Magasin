import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

// Lot B3 : enrôlement et vérification TOTP via la bibliothèque d'authentification.
export default function MfaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Vérification en deux étapes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            L’activation de la double authentification arrive avec le lot B3. Elle est obligatoire pour accéder à l’espace SuperAdmin.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
