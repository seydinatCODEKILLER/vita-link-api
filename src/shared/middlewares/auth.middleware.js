import { prisma } from "../../config/database.js";
import TokenGenerator from "../../config/jwt.js";
import {
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../errors/AppError.js";

const tokenGenerator = new TokenGenerator();

/**
 * Middleware d'authentification unifié.
 * Vérifie le JWT et attache req.user.
 * Fonctionne pour tous les utilisateurs.
 */
export const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token manquant ou format invalide");
    }

    const token = header.split(" ")[1];
    const decoded = tokenGenerator.verify(token);

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true, // Nécessaire pour role.middleware.js
        isActive: true, // Remplace status
        avatarUri: true, // Remplace avatarUrl
        healthStructureId: true, // Nécessaire pour les guards structure
        isStructureAdmin: true, // Nécessaire pour distinguer directeur/agent
      },
    });

    if (!currentUser) {
      throw new UnauthorizedError(
        "Token appartient à un utilisateur qui n'existe plus",
      );
    }

    // Sécurité : bloquer les comptes non vérifiés
    if (currentUser.status === "PENDING") {
      throw new UnauthorizedError(
        "Veuillez vérifier votre adresse email avant de continuer",
      );
    }

    req.user = currentUser;
    next();
  } catch (err) {
    next(
      err instanceof AppError
        ? err
        : new UnauthorizedError("Token invalide ou session expirée"),
    );
  }
};
