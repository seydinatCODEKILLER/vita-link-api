import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid("ID de badge invalide"),
});

// Règles communes pour la création et la mise à jour
const BadgeFields = {
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100),
  description: z.string().trim().min(5, "Description trop courte").max(500),
  iconUrl: z.string().url("URL de l'icône invalide").optional(),
  criteria: z.string().refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    {
      message:
        'Les critères doivent être un JSON valide (ex: {"minDonations": 3})',
    },
  ),
  isSeasonal: z.boolean().default(false),
  season: z.string().trim().max(50).optional(),
};

// ─── POST /badges ─────────────────────────────────────────────
export const CreateBadgeSchema = z.object({
  body: z.object({
    name: BadgeFields.name,
    description: BadgeFields.description,
    iconUrl: BadgeFields.iconUrl,
    criteria: BadgeFields.criteria,
    isSeasonal: BadgeFields.isSeasonal,
    season: BadgeFields.season,
  }),
});

// ─── PATCH /badges/:id ────────────────────────────────────────
export const UpdateBadgeSchema = z.object({
  params: uuidParam,
  body: z.object({
    name: BadgeFields.name.optional(),
    description: BadgeFields.description.optional(),
    iconUrl: BadgeFields.iconUrl,
    criteria: BadgeFields.criteria.optional(),
    isSeasonal: BadgeFields.isSeasonal.optional(),
    season: BadgeFields.season,
  }),
});

// ─── DELETE /badges/:id ───────────────────────────────────────
export const DeactivateBadgeSchema = z.object({
  params: uuidParam,
});

// ─── PATCH /badges/:id/reactivate ────────────────────────────
export const ReactivateBadgeSchema = z.object({
  params: uuidParam,
});