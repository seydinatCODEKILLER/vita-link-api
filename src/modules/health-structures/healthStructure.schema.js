import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, "Numéro de téléphone invalide");

// ─── PATCH /health-structures/me ─────────────────────────────
export const UpdateStructureSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(100).optional(),
    address: z.string().trim().min(5).optional(),
    phone: phoneSchema.optional(),
    email: z.string().trim().email().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    affiliatedCntsId: z.string().uuid("ID CNTS invalide").optional().nullable(),
  }).refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Au moins un champ doit être fourni",
  }),
});
// ─── POST /health-structures/me/staff ────────────────────────
export const AddStaffSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(50),
    lastName: z.string().trim().min(2).max(50),
    email: z.string().trim().email("Email invalide"),
    phone: phoneSchema,
    password: z.string().min(8).regex(/[A-Z]/, "Au moins une majuscule").regex(/[0-9]/, "Au moins un chiffre"),
    isStructureAdmin: z.boolean().default(false),
  }),
});

// ─── DELETE /health-structures/me/staff/:userId ───────────────
export const RemoveStaffSchema = z.object({
  params: z.object({
    userId: z.string().uuid("ID utilisateur invalide"),
  }),
});

// ─── GET /health-structures/:id ───────────────────────────────
export const GetStructureByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID structure invalide"),
  }),
});


export const GetAffiliatedHospitalsSchema = z.object({
  query: z.object({
    status: z.enum(["PENDING_REVIEW", "VERIFIED", "SUSPENDED"]).optional(),
  }).optional(),
});