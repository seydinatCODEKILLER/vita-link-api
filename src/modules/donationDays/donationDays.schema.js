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

const emptyStringToUndefined = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.undefined(),
);

// ─── GET Query — Structure ────────────────────────────────────
export const ListMyDaysSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(20),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
  }),
});

// ─── GET Query — Admin ────────────────────────────────────────
export const AdminListDaysSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(50),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// ─── GET Query — Donnor Published Days ────────────────────────
export const ListPublishedDaysSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(20),
  }),
});

// ─── POST /donation-days ──────────────────────────────────────
export const CreateDaySchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(5, "Titre trop court (min 5 caractères)")
      .max(100),
    description: z.string().trim().max(1000).optional(),
    address: z.string().trim().min(5, "Adresse requise"),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    scheduledDate: z
      .string({ message: "Date requise" })
      .transform((v) => new Date(v))
      .refine((d) => d > new Date(), {
        message: "La date doit être dans le futur",
      }),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Format HH:MM requis (ex: 08:00)"),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Format HH:MM requis (ex: 17:00)"),
    targetDonors: z.coerce.number().int().positive().default(50),
    bloodTypesNeeded: z
      .union([
        z.array(z.enum(bloodTypeValues)),
        z
          .string()
          .transform((v) =>
            v.trim() === "" ? [] : v.split(",").map((s) => s.trim()),
          ),
        z.undefined(),
        z.null(),
      ])
      .transform((v) => v ?? [])
      .pipe(z.array(z.enum(bloodTypeValues)))
      .default([]),
  }),
});

// ─── PATCH /donation-days/:id ─────────────────────────────────
export const UpdateDaySchema = z.object({
  params: z.object({ id: z.string().uuid("ID invalide") }),
  body: z
    .object({
      // ✅ FIX : On utilise emptyStringToUndefined pour ignorer les champs vides
      title: emptyStringToUndefined.or(
        z.string().trim().min(5).max(100).optional(),
      ),
      description: emptyStringToUndefined.or(
        z.string().trim().max(1000).optional(),
      ),
      address: emptyStringToUndefined.or(z.string().trim().min(5).optional()),
      latitude: emptyStringToUndefined.or(
        z.coerce.number().min(-90).max(90).optional(),
      ),
      longitude: emptyStringToUndefined.or(
        z.coerce.number().min(-180).max(180).optional(),
      ),
      scheduledDate: emptyStringToUndefined.or(
        z
          .string()
          .transform((v) => new Date(v))
          .refine((d) => d > new Date(), {
            message: "La date doit être dans le futur",
          })
          .optional(),
      ),
      startTime: emptyStringToUndefined.or(
        z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
      ),
      endTime: emptyStringToUndefined.or(
        z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
      ),
      targetDonors: emptyStringToUndefined.or(
        z.coerce.number().int().positive().optional(),
      ),
      bloodTypesNeeded: z
        .union([
          z.array(z.enum(bloodTypeValues)),
          z
            .string()
            .transform((v) =>
              v.trim() === "" ? [] : v.split(",").map((s) => s.trim()),
            ),
          z.null().transform(() => []),
        ])
        .pipe(z.array(z.enum(bloodTypeValues)))
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Au moins un champ à modifier est requis",
    }),
});

// ─── PATCH /donation-days/:id/cancel ─────────────────────────
export const CancelDaySchema = z.object({
  params: z.object({ id: z.string().uuid("ID invalide") }),
  body: z.object({
    cancelReason: z
      .string()
      .trim()
      .min(5, "La raison d'annulation est requise (min 5 caractères)")
      .max(500),
  }),
});

// ─── Params ID simple ─────────────────────────────────────────
export const IdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID invalide") }),
});

// ─── PATCH /registrations/:registrationId/attend ──────────────
export const AttendanceSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID journée invalide"),
    registrationId: z.string().uuid("ID inscription invalide"),
  }),
  body: z.object({
    status: z.enum(["ATTENDED", "NO_SHOW"], {
      message: "Statut invalide : ATTENDED ou NO_SHOW attendu",
    }),
  }),
});
