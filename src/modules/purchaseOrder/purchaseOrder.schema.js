import { z } from "zod";

export const ScanPurchaseOrderSchema = z.object({
  params: z.object({
    code: z.string().min(1, "Le code est requis"),
  }),
});

export const GetPurchaseOrderSchema = z.object({
  params: z.object({
    bloodRequestId: z.string().uuid("ID invalide"),
  }),
});

export const ListPurchaseOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["PENDING", "USED", "EXPIRED", "CANCELLED"]).optional(),
  }),
});

export const ConfirmExpirySchema = z.object({
  params: z.object({
    id: z.string().uuid("ID invalide"),
  }),
  body: z.object({
    wasDelivered: z.boolean({
      required_error: "Le champ wasDelivered est requis (true ou false)",
    }),
    cntsNotes: z.string().max(500).optional(),
  }),
});
