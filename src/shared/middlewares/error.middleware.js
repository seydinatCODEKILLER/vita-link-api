import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";
import logger from "../../config/logger.js";

// ─── 404 ──────────────────────────────────────────────────────
export const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route introuvable : ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
};

// ─── Global error handler ─────────────────────────────────────
export const errorHandler = (err, req, res, _next) => {

  // Log structuré selon l'environnement
  if (env.IS_DEV) {
    logger.error({ err, url: req.originalUrl, method: req.method }, "❌ Erreur");
  } else {
    logger.error({ code: err.code || err.name, url: req.originalUrl }, err.message);
  }

  // A. Erreurs opérationnelles (AppError et sous-classes)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  // B. Erreurs Zod (validation — si non catchées par le middleware validate())
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Erreur de validation des données",
      errors: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // C. Erreurs Prisma
  if (err.code === "P2002") {
    const field = err.meta?.target?.join(", ") || "champ";
    return res.status(409).json({
      success: false,
      code: "CONFLICT",
      message: `Un enregistrement avec ce ${field} existe déjà`,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      message: "Enregistrement introuvable",
    });
  }

  if (err.code === "P2003") {
    return res.status(400).json({
      success: false,
      code: "FOREIGN_KEY_ERROR",
      message: "Référence invalide — l'entité liée n'existe pas",
    });
  }

  if (err.code === "P2023" || err.code === "P2006") {
    return res.status(400).json({
      success: false,
      code: "INVALID_ID",
      message: "Format d'identifiant invalide",
    });
  }

  // D. Erreurs JWT (filet de sécurité — normally caught in authenticate middleware)
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Token invalide. Veuillez vous reconnecter",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      code: "TOKEN_EXPIRED",
      message: "Session expirée. Veuillez vous reconnecter",
    });
  }

  // E. Erreur inconnue (bug)
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: env.IS_PROD
      ? "Une erreur interne est survenue"
      : err.message,
  });
};