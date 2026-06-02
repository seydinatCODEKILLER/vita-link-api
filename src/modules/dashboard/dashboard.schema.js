import { z } from "zod";

// ─── GET /dashboard/cnts ─────────────────────────────────────
export const CntsDashboardSchema = z.object({
  query: z.object({
    // Limiter le nombre de demandes récentes à afficher
    recentRequestsLimit: z.coerce.number().int().min(1).max(20).default(5).optional(),
  }).optional(),
});

// ─── GET /dashboard/hospital ──────────────────────────────────
export const HospitalDashboardSchema = z.object({
  query: z.object({
    // Limiter le nombre de demandes de l'hôpital à afficher
    myRequestsLimit: z.coerce.number().int().min(1).max(20).default(5).optional(),
  }).optional(),
});