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

// ─── PATCH /blood-stocks/me ──────────────────────────────────
export const UpdateMyStockSchema = z.object({
  body: z.object({
    bloodType: z.enum(bloodTypeValues, {
      errorMap: () => ({ message: "Groupe sanguin invalide" }),
    }),
    quantity: z
      .number()
      .int()
      .min(0, "La quantité ne peut pas être négative")
      .max(500, "Quantité irréaliste"),
  }),
});

// ─── GET /blood-stocks (Admin) ───────────────────────────────
export const ListAllStocksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    level: z.enum(["CRITICAL", "LOW", "ADEQUATE", "SURPLUS"]).optional(),
  }),
});
