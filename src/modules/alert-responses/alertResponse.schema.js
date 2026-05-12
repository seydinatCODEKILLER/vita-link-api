import { z } from "zod";

const uuidParam = z.string().uuid("ID invalide");

// ─── POST /confirm ───────────────────────────────────────────────
export const ConfirmResponseSchema = z.object({
  params: z.object({ alertId: uuidParam }),
  body: z.object({
    etaMinutes: z.number().min(1).max(120).optional(),
  }),
});

// ─── POST /decline ────────────────────────────────────────────────
export const DeclineResponseSchema = z.object({
  params: z.object({ alertId: uuidParam }),
});

// ─── PATCH /arrived ────────────────────────────────────────────────
export const ArrivedResponseSchema = z.object({
  params: z.object({ alertId: uuidParam }),
  body: z.object({
    donorId: uuidParam,               // ← ajout : l'agent doit identifier le donneur
  }),
});

// ─── PATCH /no-show ───────────────────────────────────────────────
export const NoShowResponseSchema = z.object({
  params: z.object({ alertId: uuidParam }),
  body: z.object({
    donorId: uuidParam,               // ← ajout : l'agent doit identifier le donneur
  }),
});