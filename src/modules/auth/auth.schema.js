import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────
const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+?[1-9]\d{7,14}$/,
    "Numéro de téléphone invalide (ex: +221771234567)",
  );

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre");

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

const SENEGAL_REGIONS = [
  "Dakar",
  "Diourbel",
  "Fatick",
  "Kaffrine",
  "Kaolack",
  "Kédougou",
  "Kolda",
  "Louga",
  "Matam",
  "Sédhiou",
  "Saint-Louis",
  "Tambacounda",
  "Thiès",
  "Ziguinchor",
];

// ─── POST /auth/register/donor ────────────────────────────────
export const RegisterDonorSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2, "Prénom trop court").max(50),
    lastName: z.string().trim().min(2, "Nom trop court").max(50),
    phone: phoneSchema,
    email: z.string().trim().email("Email invalide").optional(),
    bloodType: z.enum(bloodTypeValues, {
      errorMap: () => ({ message: "Groupe sanguin invalide" }),
    }).optional(),
    gender: z.enum(["MALE", "FEMALE"], {
      errorMap: () => ({ message: "Genre invalide" }),
    }),
    dateOfBirth: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), "Date de naissance invalide")
      .transform((v) => new Date(v))
      .optional(),
  }),
});

// ─── POST /auth/register/health-structure ────────────────────
export const RegisterHealthStructureSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(50),
    lastName: z.string().trim().min(2).max(50),
    email: z.string().trim().email("Email invalide"),
    phone: phoneSchema,
    password: passwordSchema,
    structureName: z
      .string()
      .trim()
      .min(3, "Nom de structure trop court")
      .max(100),
    registrationNumber: z
      .string()
      .trim()
      .min(3, "Numéro d'enregistrement invalide"),
    address: z.string().trim().min(5, "Adresse trop courte"),
    region: z.enum(SENEGAL_REGIONS, {
      errorMap: () => ({ message: "Veuillez sélectionner une région valide parmi les 14 régions" }),
    }),
    structurePhone: phoneSchema.optional(),
    structureEmail: z.string().trim().email().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

// ─── POST /auth/otp/send ──────────────────────────────────────
export const SendOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email invalide"),
  }),
});

// ─── POST /auth/otp/verify ────────────────────────────────────
export const VerifyOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email invalide"),
    code: z
      .string()
      .trim()
      .length(6)
      .regex(/^\d{6}$/),
    phone: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .pipe(
        z.string().regex(/^\+?[1-9]\d{7,14}$/, "Numéro de téléphone invalide"),
      )
      .optional(),

    firstName: z
      .string()
      .trim()
      .min(2, "Prénom trop court")
      .max(50)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),

    lastName: z
      .string()
      .trim()
      .min(2, "Nom trop court")
      .max(50)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),

    bloodType: z
      .enum(bloodTypeValues)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),

    gender: z
      .enum(["MALE", "FEMALE"])
      .transform((v) => (v === "" ? undefined : v))
      .optional(),

    dateOfBirth: z
      .string()
      .transform((v) => (v === "" ? undefined : v))
      .pipe(
        z
          .string()
          .refine((v) => !isNaN(Date.parse(v)), "Date invalide")
          .transform((v) => new Date(v)),
      )
      .optional(),
  }),
});

// ─── POST /auth/login ─────────────────────────────────────────
export const LoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email invalide"),
    password: z.string().min(1, "Mot de passe requis"),
  }),
});

// ─── POST /auth/refresh ───────────────────────────────────────
export const RefreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token requis"),
  }),
});
