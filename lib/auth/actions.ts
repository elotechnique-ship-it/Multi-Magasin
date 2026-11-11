"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sanitizeNext } from "@/lib/security/redirect";
import { fr } from "@/lib/i18n/fr";

export type FormState = { error?: string; success?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  next: z.string().max(2048).optional(),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: fr.auth.invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // Message générique : on ne distingue pas « compte inexistant » de « mot de passe erroné ».
  if (error) return { error: fr.auth.invalid };

  redirect(sanitizeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/connexion");
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/reinitialisation`,
    });
  }
  // Même réponse dans tous les cas : pas d'énumération de comptes.
  return { success: fr.auth.forgotSent };
}

const resetSchema = z.object({ password: z.string().min(12).max(128) });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Le mot de passe doit contenir au moins 12 caractères." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Lien expiré. Recommencez la procédure." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Impossible de mettre à jour le mot de passe." };
  redirect("/magasin");
}

const tokenSchema = z.object({ token: z.string().min(16).max(256) });

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = tokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invitation invalide ou expirée." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: parsed.data.token });
  if (error) return { error: "Invitation invalide ou expirée." };
  redirect("/magasin");
}
