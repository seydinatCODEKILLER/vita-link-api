import jwt from "jsonwebtoken";
import { env } from "./env.js";

export default class TokenGenerator {
  sign(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_DURATION || "15m",
    });
  }

  verify(token) {
    try {
      return jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      if (err.name === "JsonWebTokenError") {
        throw new Error("Token invalide");
      }
      throw new Error("Erreur d'authentification");
    }
  }

  signRefresh(payload) {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_DURATION || "30d",
    });
  }

  verifyRefresh(token) {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      throw new Error("Refresh token invalide");
    }
  }
}