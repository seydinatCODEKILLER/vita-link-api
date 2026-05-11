import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

// ─── Validation au démarrage ──────────────────────────────────
const REQUIRED_ALWAYS = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "DIRECT_URL"];

const REQUIRED_IN_PROD = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "WEB_URL",
  "BREVO_API_KEY",
  "MAIL_FROM",
  "DUMMY_HASH",
];

const missing = [
  ...REQUIRED_ALWAYS.filter((k) => !process.env[k]),
  ...(isProd ? REQUIRED_IN_PROD.filter((k) => !process.env[k]) : []),
];

if (missing.length > 0) {
  console.error("❌ Variables d'environnement manquantes :");
  missing.forEach((k) => console.error(`   → ${k}`));
  process.exit(1);
}

// ─── Validation PORT ──────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`❌ PORT invalide : "${process.env.PORT}"`);
  process.exit(1);
}

if (!process.env.JWT_DURATION) {
  console.warn("⚠️  JWT_DURATION non défini — valeur par défaut : 15m");
}
if (!process.env.JWT_REFRESH_DURATION) {
  console.warn("⚠️  JWT_REFRESH_DURATION non défini — valeur par défaut : 30d");
}

// ─── Export ───────────────────────────────────────────────────
export const env = {
  PORT,
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PROD: isProd,
  IS_DEV: process.env.NODE_ENV === "development",

  // ─── Base de données (Supabase) ───────────────────────────
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,

  // ─── JWT ──────────────────────────────────────────────────
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_DURATION: process.env.JWT_DURATION || "15m",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_DURATION: process.env.JWT_REFRESH_DURATION || "30d",

  // ─── Cloudinary (avatars + logos partenaires) ─────────────
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  // ─── Brevo (emails OTP) ───────────────────────────────────
  BREVO_API_KEY: process.env.BREVO_API_KEY || "",
  MAIL_FROM: process.env.MAIL_FROM || "noreply@vita-link.sn",

  // ─── CORS ─────────────────────────────────────────────────
  WEB_URL: process.env.WEB_URL || "",
  WEB_URL_DEV: process.env.WEB_URL_DEV || "http://localhost:3001",
  SWAGGER_URL: process.env.SWAGGER_URL,

  // ─── Sécurité ─────────────────────────────────────────────
  DUMMY_HASH: process.env.DUMMY_HASH || "$2b$10$abcdefghijklmnopqrstuuVVmqJZOdEJ.JkpjBnBnNmS6RsOi8jCy",

  // ─── Logs ─────────────────────────────────────────────────
  LOG_LEVEL: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
};