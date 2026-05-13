import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid("ID de partenaire invalide"),
});

// Règles communes (sans logoUrl)
const PartnerFields = {
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(150),
  description: z.string().trim().max(1000).optional(),
  websiteUrl: z.string().url("URL du site web invalide").optional(),
};

// ─── POST /partners ───────────────────────────────────────────
export const CreatePartnerSchema = z.object({
  body: z.object({
    name: PartnerFields.name,
    description: PartnerFields.description,
    websiteUrl: PartnerFields.websiteUrl,
  }),
});

// ─── PATCH /partners/:id ──────────────────────────────────────
export const UpdatePartnerSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: PartnerFields.name.optional(),
      description: PartnerFields.description,
      websiteUrl: PartnerFields.websiteUrl,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni",
    }),
});

// ─── DELETE /partners/:id ─────────────────────────────────────
export const DeactivatePartnerSchema = z.object({
  params: uuidParam,
});
