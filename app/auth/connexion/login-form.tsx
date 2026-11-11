"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type FormState } from "@/lib/auth/actions";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

const initial: FormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, initial);
  return (
    <Card>
      <CardHeader><CardTitle>{fr.auth.loginTitle}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <div>
            <Label htmlFor="email">{fr.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required aria-invalid={state.error ? true : undefined} />
          </div>
          <div>
            <Label htmlFor="password">{fr.auth.password}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={state.error ? true : undefined} />
          </div>
          {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Connexion…" : fr.auth.submit}</Button>
          <Link href="/auth/mot-de-passe-oublie" className="text-sm text-primary underline">{fr.auth.forgot}</Link>
        </form>
      </CardContent>
    </Card>
  );
}
