import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Commerce", template: "%s · Commerce" },
  description: "Plateforme de gestion commerciale multi-magasins",
  robots: { index: false, follow: false }, // espace applicatif : pas d'indexation (la boutique publique aura ses propres métadonnées)
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F172A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
