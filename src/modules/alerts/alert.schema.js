import { z } from "zod";

const bloodTypeValues = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
];

// ─── POST /alerts ─────────────────────────────────────────────
export const CreateAlertSchema = z.object({
  body: z.object({
    bloodType: z.enum(bloodTypeValues, {
      errorMap: () => ({ message: "Groupe sanguin invalide" }),
    }),
    quantityNeeded: z
      .number()
      .int()
      .min(1, "Au moins 1 poche requise")
      .max(20, "Quantité maximale : 20 poches"),
    urgencyLevel: z.enum(["VITAL", "STANDARD"], {
      errorMap: () => ({
        message: "Niveau d'urgence invalide (VITAL | STANDARD)",
      }),
    }),
    serviceUnit: z
      .enum(
        [
          "EMERGENCY_ROOM",
          "OPERATING_ROOM",
          "MATERNITY",
          "GENERAL",
          "PEDIATRICS",
        ],
        { errorMap: () => ({ message: "Unité de service invalide" }) },
      )
      .default("GENERAL"),
    radiusKm: z.number().min(1).max(50).default(10),
    address: z.string().trim().max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    expiresAt: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), "Date d'expiration invalide")
      .transform((v) => new Date(v))
      .optional(),

    // ← NOUVEAU : Pour la traçabilité CNTS / Escalade
    origin: z
      .enum(["CNTS_DIRECT", "CNTS_ESCALATION", "HOSPITAL_DIRECT"])
      .optional(),
    bloodRequestId: z
      .string()
      .uuid("ID de demande de sang invalide")
      .optional(),
  }),
});

// ─── GET /alerts (donneurs) — query params ────────────────────
export const ListNearbyAlertsSchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(100).default(15),
  }),
});

// ─── GET /alerts/my-structure — query params ──────────────────
export const ListStructureAlertsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z
      .enum(["ACTIVE", "QUOTA_REACHED", "EXPIRED", "CANCELLED"])
      .optional(),
  }),
});

// ─── GET /alerts/:id/responses — query params ─────────────────
export const ListResponsesSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID d'alerte invalide"),
  }),
});
