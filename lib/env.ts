import { z } from "zod";

// Variables PUBLIQUES uniquement (inlinées dans le bundle navigateur). Aucun secret ici.
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

// Référence explicite requise pour que Next.js inline les NEXT_PUBLIC_* au build.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
