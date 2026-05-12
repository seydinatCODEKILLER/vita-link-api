import { z } from "zod";

// ─── POST /donations/scan ─────────────────────────────────────
export const ScanDonationSchema = z.object({
  body: z.object({
    qrCode: z
      .string()
      .trim()
      .min(1, "QR Code requis")
      .regex(
        /^VITA-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
        "Format de QR Code invalide (attendu : VITA-XXXX-XXXX)",
      ),
    notes: z.string().trim().max(500).optional(),
    testResultsJson: z.string().trim().optional(), // JSON résultats analyse sang
  }),
});

// ─── GET /donations/me — query params ────────────────────────
export const ListMyDonationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

// ─── GET /donations/structure — query params ──────────────────
export const ListStructureDonationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});
