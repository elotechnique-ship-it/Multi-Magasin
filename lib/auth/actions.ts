"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionToken } from "@/lib/auth/session";
import { withSession } from "@/lib/db/with-session";
import { acceptInvitationRpc } from "@/lib/db/queries/stores";

export type FormState = { error?: string; success?: string };

const UNAVAILABLE = "L'authentification arrive avec le lot B3 : la connexion n'est pas encore disponible.";

// Lot B3 : connexion, déconnexion, réinitialisation de mot de passe (bibliothèque d'authentification).
export async function login(_prev: FormState, _formData: FormData): Promise<FormState> {
  return { error: UNAVAILABLE };
}

export async function signOut(): Promise<void> {
  redirect("/auth/connexion");
}

export async function requestPasswordReset(_prev: FormState, _formData: FormData): Promise<FormState> {
  // Même réponse dans tous les cas (pas d'énumération de comptes) ; l'envoi réel arrive avec B3/B4.
  return { success: "Si un compte existe pour cette adresse, un lien de réinitialisation sera envoyé (disponible au lot B3)." };
}

export async function updatePassword(_prev: FormState, _formData: FormData): Promise<FormState> {
  return { error: UNAVAILABLE };
}

const tokenSchema = z.object({ token: z.string().min(16).max(256) });

/** Réel dès B2 : la base vérifie le jeton d'invitation, l'adresse e-mail du compte connecté et l'expiration. */
export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = tokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invitation invalide ou expirée." };

  const session = await requireSessionToken("/auth/invitation");
  try {
    await withSession(session, (tx) => acceptInvitationRpc(tx, parsed.data.token));
  } catch {
    return { error: "Invitation invalide ou expirée." }; // message générique : aucune fuite sur l'existence du jeton
  }
  redirect("/magasin");
}
