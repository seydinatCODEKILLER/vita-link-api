// middlewares/role.middleware.js
import { ForbiddenError } from "../errors/AppError.js";

/**
 * Guard de rôle — à utiliser après authenticate()
 * Usage : requireRole("ADMIN") ou requireRole("HEALTH_STRUCTURE", "ADMIN")
 */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ForbiddenError("Non authentifié"));
  }

  if (!roles.includes(req.user.role)) {
    return next(new ForbiddenError("Accès refusé — droits insuffisants"));
  }

  next();
};

/**
 * Guard spécifique — vérifie que l'agent appartient bien
 * à la structure qu'il essaie de gérer
 * Usage : sur les routes /health-structures/me/*
 */
export const requireStructureMember = (req, _res, next) => {
  if (!req.user.healthStructureId) {
    return next(new ForbiddenError("Vous n'êtes rattaché à aucune structure de santé"));
  }
  next();
};

/**
 * Guard spécifique — vérifie que c'est bien le directeur
 * (isStructureAdmin = true) et non un simple agent
 * Usage : sur les routes d'ajout/retrait d'agents
 */
export const requireStructureAdmin = (req, _res, next) => {
  if (!req.user.isStructureAdmin) {
    return next(new ForbiddenError("Réservé au directeur de la structure"));
  }
  next();
};