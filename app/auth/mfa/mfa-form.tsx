"use client";

import type * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

type Mode = "loading" | "enroll" | "verify";

export function MfaForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) {
        setError("Impossible de charger la vérification en deux étapes.");
        return;
      }
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (cancelled) return;
      if (enrollError || !enrolled) {
        setError("Impossible de démarrer l’enrôlement.");
        return;
      }
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setMode("enroll");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setBusy(false);
      setError("Échec de la vérification. Réessayez.");
      return;
    }
    const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: code.trim() });
    if (verify.error) {
      setBusy(false);
      setError("Code incorrect ou expiré.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérification en deux étapes</CardTitle>
      </CardHeader>
      <CardContent>
        {mode === "loading" && !error ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {mode === "enroll" && qr ? (
          <div className="mb-4 flex flex-col gap-2">
            <p className="text-sm">Scannez ce code avec votre application d’authentification, puis saisissez le code à 6 chiffres.</p>
            {/* data: URL SVG générée par Supabase Auth */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Code QR d’enrôlement TOTP" className="h-44 w-44 self-center" />
            {secret ? (
              <p className="text-xs text-muted-foreground">
                Saisie manuelle : <span className="tabular break-all font-mono">{secret}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        {mode !== "loading" ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="code">Code à 6 chiffres</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy || code.length !== 6}>
              Valider
            </Button>
          </form>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
