"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/lib/auth/actions";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <Card>
      <CardHeader><CardTitle>{fr.auth.resetTitle}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="password">{fr.auth.password} (12 caractères minimum)</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
          </div>
          {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending}>Enregistrer</Button>
        </form>
      </CardContent>
    </Card>
  );
}
