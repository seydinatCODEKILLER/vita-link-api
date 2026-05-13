import { z } from "zod";

// ─── GET /notifications/me ────────────────────────────────────
export const ListMyNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    isRead: z.enum(["true", "false"]).optional(), // Filtre optionnel
  }),
});

// ─── PATCH /notifications/:id/read ───────────────────────────
export const MarkAsReadSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de notification invalide"),
  }),
});
