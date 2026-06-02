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

const idParam = z.object({
  params: z.object({ id: z.string().uuid("ID invalide") }),
});

// ─── POST /blood-requests ─────────────────────────────────────
export const CreateBloodRequestSchema = z.object({
  body: z.object({
    bloodType: z.enum(bloodTypeValues, {
      errorMap: () => ({ message: "Groupe sanguin invalide" }),
    }),
    quantityNeeded: z.number().int().min(1).max(50),
    urgencyLevel: z.enum(["VITAL", "STANDARD"]),
    serviceUnit: z
      .enum([
        "EMERGENCY_ROOM",
        "OPERATING_ROOM",
        "MATERNITY",
        "GENERAL",
        "PEDIATRICS",
      ])
      .default("GENERAL"),
    clinicalContext: z.string().trim().max(500).optional(),
  }),
});

// ─── POST /blood-requests/:id/handle ─────────────────────────
export const HandleBloodRequestSchema = z.object({
  params: z.object({ id: z.string().uuid("ID invalide") }),
  body: z
    .object({
      action: z.enum(["FULFILL", "PARTIALLY_FULFILL", "ESCALATE", "REJECT"], {
        errorMap: () => ({ message: "Action invalide" }),
      }),
      quantityProvided: z.number().int().min(1).optional(),
      cntsNotes: z.string().trim().max(500).optional(),
      radiusKm: z.number().min(1).max(100).optional().default(10), // ✅ AJOUT
    })
    .refine(
      (data) => {
        if (
          data.action === "PARTIALLY_FULFILL" &&
          (data.quantityProvided === undefined || data.quantityProvided <= 0)
        ) {
          return false;
        }
        return true;
      },
      {
        message:
          "quantityProvided est requis et doit être > 0 pour une fourniture partielle",
        path: ["quantityProvided"],
      },
    ),
});

// ─── GET /blood-requests ──────────────────────────────────────
export const ListBloodRequestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z
      .enum([
        "PENDING",
        "FULFILLED",
        "PARTIALLY_FULFILLED",
        "ESCALATED_TO_ALERT",
        "REJECTED",
        "CANCELLED",
      ])
      .optional(),
  }),
});

// ─── GET /blood-requests/:id ──────────────────────────────────
export const GetBloodRequestByIdSchema = idParam;

// ─── PATCH /blood-requests/:id/cancel ────────────────────────
export const CancelBloodRequestSchema = idParam;
