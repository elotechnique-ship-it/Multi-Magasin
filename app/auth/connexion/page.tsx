import type { Metadata } from "next";
import { sanitizeNext } from "@/lib/security/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <LoginForm next={sanitizeNext(next)} />
    </main>
  );
}
