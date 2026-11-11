"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <Card>
      <CardHeader><CardTitle>{fr.auth.forgotTitle}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">{fr.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {state.success ? <p role="status" className="text-sm">{state.success}</p> : null}
          <Button type="submit" disabled={pending}>Envoyer le lien</Button>
        </form>
      </CardContent>
    </Card>
  );
}
