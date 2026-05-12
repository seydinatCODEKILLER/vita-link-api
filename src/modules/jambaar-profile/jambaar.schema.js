import { z } from "zod";

// ─── GET /jambaar/leaderboard — query params ──────────────────
export const LeaderboardSchema = z.object({
  query: z.object({
    city:     z.string().trim().min(2).max(100).optional(),
    district: z.string().trim().min(2).max(100).optional(),
    page:     z.coerce.number().int().min(1).default(1),
    limit:    z.coerce.number().int().min(1).max(100).default(20),
  }),
});