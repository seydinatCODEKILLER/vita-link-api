import { prisma } from "../config/database.js";
import logger from "../config/logger.js";

export const runTokenExpireJob = async () => {
  try {
    const now = new Date();

    // 1. Supprimer les codes OTP qui ont expiré (ne sert plus à rien de les garder)
    const deletedOtps = await prisma.otpCode.deleteMany({
      where: { expiresAt: { lte: now } },
    });

    // 2. Révoquer les Refresh Tokens expirés (mettre à null pour libérer l'espace)
    const revokedTokens = await prisma.user.updateMany({
      where: {
        refreshTokenExpiresAt: { lte: now, not: null },
      },
      data: {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      },
    });

    const totalCleaned = deletedOtps.count + revokedTokens.count;
    
    if (totalCleaned > 0) {
      logger.logEvent("CRON_TOKENS_CLEANED", {
        expiredOtps: deletedOtps.count,
        revokedRefreshTokens: revokedTokens.count,
      });
    }
  } catch (err) {
    logger.error({ err }, "Erreur CRON tokenExpire");
  }
};