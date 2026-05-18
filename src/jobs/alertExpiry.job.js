import { prisma } from "../config/database.js";
import logger from "../config/logger.js";

export const runAlertExpiryJob = async () => {
  try {
    const now = new Date();

    // 1️⃣ ÉTAPE 1 : Les alertes expirées dont le QUOTA EST ATTEINT
    // → On les passe en QUOTA_REACHED (Succès retardé)
    const quotaReached = await prisma.alert.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
        quantityConfirmed: { gte: prisma.alert.fields.quantityNeeded }, // ✅ Condition intelligente
      },
      data: { status: "QUOTA_REACHED", closedAt: now },
    });

    // 2️⃣ ÉTAPE 2 : Les alertes expirées dont le QUOTA N'EST PAS ATTEINT
    // → Seulement là, on les passe en EXPIRED (Échec)
    const expired = await prisma.alert.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
        quantityConfirmed: { lt: prisma.alert.fields.quantityNeeded },
      },
      data: { status: "EXPIRED" },
    });

    const totalAffected = quotaReached.count + expired.count;
    if (totalAffected > 0) {
      logger.logEvent("CRON_ALERTS_EXPIRED", {
        quotaReached: quotaReached.count,
        expired: expired.count,
      });
    }
  } catch (err) {
    logger.error({ err }, "Erreur CRON alertExpiry");
  }
};
