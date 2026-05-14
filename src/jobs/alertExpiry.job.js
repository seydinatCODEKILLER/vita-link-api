import { prisma } from "../config/database.js";
import logger from "../config/logger.js";

export const runAlertExpiryJob = async () => {
  try {
    const result = await prisma.alert.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });

    if (result.count > 0) {
      logger.logEvent("CRON_ALERTS_EXPIRED", { count: result.count });
    }
  } catch (err) {
    logger.error({ err }, "Erreur CRON alertExpiry");
  }
};