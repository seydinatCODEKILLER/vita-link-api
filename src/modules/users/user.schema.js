import { z } from "zod";

// ─── PATCH /me — infos générales ─────────────────────────────
export const UpdateProfileSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .trim()
        .min(2, "Prénom trop court")
        .max(50)
        .optional(),
      lastName: z.string().trim().min(2, "Nom trop court").max(50).optional(),
      gender: z
        .enum(["MALE", "FEMALE"], {
          errorMap: () => ({ message: "Genre invalide" }),
        })
        .optional(),
      bloodType: z
        .enum(
          [
            "A_POS",
            "A_NEG",
            "B_POS",
            "B_NEG",
            "AB_POS",
            "AB_NEG",
            "O_POS",
            "O_NEG",
          ],
          {
            errorMap: () => ({ message: "Groupe sanguin invalide" }),
          },
        )
        .optional(),
      dateOfBirth: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)), "Date de naissance invalide")
        .transform((v) => new Date(v))
        .optional(),
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: "Au moins un champ doit être fourni",
    }),
});

// ─── PATCH /me/location ───────────────────────────────────────
export const UpdateLocationSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

// ─── PATCH /me/availability ───────────────────────────────────
export const UpdateAvailabilitySchema = z.object({
  body: z.object({
    isAvailable: z.boolean(),
  }),
});

// ─── PATCH /me/expo-token ─────────────────────────────────────
export const UpdateExpoTokenSchema = z.object({
  body: z.object({
    expoPushToken: z
      .string()
      .trim()
      .min(1, "Token requis")
      .regex(/^ExponentPushToken\[.+\]$/, "Format de token Expo invalide"),
  }),
});
