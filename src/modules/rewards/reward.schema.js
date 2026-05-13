import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid("ID de récompense invalide"),
});

const rewardTypeValues = [
  "DISCOUNT_COUPON",
  "TRANSPORT_TICKET",
  "HEALTH_CHECKUP",
  "DATA_BUNDLE",
  "OTHER",
];

// Règles communes
const RewardFields = {
  partnerId: z.string().uuid("ID de partenaire invalide"),
  title: z
    .string()
    .trim()
    .min(2, "Le titre doit contenir au moins 2 caractères")
    .max(150),
  description: z.string().trim().min(5, "Description trop courte").max(1000),
  pointsCost: z.number().int().min(1, "Le coût en points doit être au moins 1"),
  rewardType: z.enum(rewardTypeValues, {
    errorMap: () => ({ message: "Type de récompense invalide" }),
  }),
  stockQuantity: z.number().int().min(0).default(0),
  isUnlimited: z.boolean().default(false),
  expiresAt: z.coerce.date().optional().nullable(), // Converti le string en Date
};

// ─── POST /rewards ────────────────────────────────────────────
export const CreateRewardSchema = z.object({
  body: z.object({
    partnerId: RewardFields.partnerId,
    title: RewardFields.title,
    description: RewardFields.description,
    pointsCost: RewardFields.pointsCost,
    rewardType: RewardFields.rewardType,
    stockQuantity: RewardFields.stockQuantity,
    isUnlimited: RewardFields.isUnlimited,
    expiresAt: RewardFields.expiresAt,
  }),
});

// ─── PATCH /rewards/:id ───────────────────────────────────────
export const UpdateRewardSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      partnerId: RewardFields.partnerId.optional(),
      title: RewardFields.title.optional(),
      description: RewardFields.description.optional(),
      pointsCost: RewardFields.pointsCost.optional(),
      rewardType: RewardFields.rewardType.optional(),
      stockQuantity: RewardFields.stockQuantity.optional(),
      isUnlimited: RewardFields.isUnlimited.optional(),
      expiresAt: RewardFields.expiresAt,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ doit être fourni pour la mise à jour",
    }),
});

// ─── DELETE /rewards/:id ──────────────────────────────────────
export const DeactivateRewardSchema = z.object({
  params: uuidParam,
});
