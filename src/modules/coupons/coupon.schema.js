import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid("ID invalide"),
});

// ─── POST /coupons/redeem/:rewardId ──────────────────────────
export const RedeemRewardSchema = z.object({
  params: z.object({
    rewardId: z.string().uuid("ID de récompense invalide"),
  }),
});

// ─── GET /coupons/me ─────────────────────────────────────────
export const ListMyCouponsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["ACTIVE", "USED", "EXPIRED"]).optional(),
  }),
});

// ─── PATCH /coupons/:id/use ──────────────────────────────────
export const UseCouponSchema = z.object({
  params: uuidParam,
});
