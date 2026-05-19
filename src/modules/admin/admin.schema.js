// admin/admin.schema.js
import { z } from "zod";

// ─── Params partagés ─────────────────────────────────────────
const uuidParam = z.string().uuid("ID invalide");

// ─── GET /admin/users ─────────────────────────────────────────
export const GetUsersSchema = z.object({
  query: z.object({
    role: z.enum(["DONOR", "HEALTH_STRUCTURE", "ADMIN"]).optional(),
    bloodType: z
      .enum([
        "A_POS",
        "A_NEG",
        "B_POS",
        "B_NEG",
        "AB_POS",
        "AB_NEG",
        "O_POS",
        "O_NEG",
      ])
      .optional(),
    city: z.string().trim().optional(),
    isActive: z
      .string()
      .optional()
      .transform((v) =>
        v === "true" ? true : v === "false" ? false : undefined,
      ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// ─── GET /admin/users/:id ─────────────────────────────────────
export const GetUserByIdSchema = z.object({
  params: z.object({ id: uuidParam }),
});

// ─── PATCH /admin/users/:id/suspend ──────────────────────────
export const SuspendUserSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    reason: z
      .string()
      .trim()
      .min(5, "Raison requise (min 5 caractères)")
      .optional(),
  }),
});

// ─── PATCH /admin/users/:id/reactivate ───────────────────────
export const ReactivateUserSchema = z.object({
  params: z.object({ id: uuidParam }),
});

// ─── GET /admin/health-structures ────────────────────────────
export const GetStructuresSchema = z.object({
  query: z.object({
    status: z.enum(["PENDING_REVIEW", "VERIFIED", "SUSPENDED"]).optional(),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v) : 1)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v) : 20)),
  }),
});

// ─── PATCH /admin/health-structures/:id/verify ───────────────
export const VerifyStructureSchema = z.object({
  params: z.object({ id: uuidParam }),
});

// ─── PATCH /admin/health-structures/:id/suspend ──────────────
export const SuspendStructureSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    reason: z.string().trim().min(5, "Raison requise").optional(),
  }),
});

// ─── GET /admin/audit-logs ────────────────────────────────────
export const GetAuditLogsSchema = z.object({
  query: z.object({
    entityType: z.string().trim().optional(),
    entityId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    action: z.string().trim().optional(),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v) : 1)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v) : 50)),
  }),
});


// ─── GET /admin/stats/monthly ────────────────────────────────
export const GetMonthlyStatsSchema = z.object({
  query: z.object({
    year: z.string().optional().transform((v) => (v ? parseInt(v) : undefined)),
  }),
});

// ─── GET /admin/stats/regions ────────────────────────────────
export const GetRegionStatsSchema = z.object({
  query: z.object({}).optional(), // Pas de filtres pour l'instant
});