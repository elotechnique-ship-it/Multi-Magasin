"use client";

import { useActionState } from "react";
import { acceptInvitation, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvitation, {});
  return (
    <Card>
      <CardHeader><CardTitle>Rejoindre un magasin</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-muted-foreground">Confirmez pour rejoindre le magasin avec le compte actuellement connecté.</p>
          {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending || token.length === 0}>Accepter l’invitation</Button>
        </form>
      </CardContent>
    </Card>
  );
}
