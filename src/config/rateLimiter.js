import rateLimit from "express-rate-limit";

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  if (req.headers["x-real-ip"]) return req.headers["x-real-ip"];
  return req.ip;
};

// ─── Général ──────────────────────────────────────────────────
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: "Trop de requêtes, veuillez réessayer plus tard" },
  skip: (req) => {
    const exempted = ["/auth/me", "/auth/refresh-token", "/auth/refresh"];
    return exempted.some((path) => req.path.endsWith(path));
  },
});

// ─── Auth : login ─────────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
});

// ─── Auth : inscription ───────────────────────────────────────
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: "Trop de tentatives d'inscription. Réessayez dans une heure." },
});

// ─── Auth : refresh token ─────────────────────────────────────
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: "Trop de tentatives de rafraîchissement de token." },
});

// ─── Uploads ──────────────────────────────────────────────────
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: "Trop d'uploads. Réessayez plus tard." },
});

// ─── CRUD général ─────────────────────────────────────────────
export const crudLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: "Trop de requêtes. Veuillez patienter." },
});

// ─── Alertes médicales — anti-spam critique ───────────────────
export const alertLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 5,                // max 5 alertes par minute par IP
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: "Trop d'alertes émises. Veuillez patienter." },
})