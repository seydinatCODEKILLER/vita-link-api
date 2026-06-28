import { prisma } from "../config/database.js";
import { emitToUser } from "../config/socket.js";
import logger from "../config/logger.js";

export const runEligibilityDonateJob = async () => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000);

    const newlyEligible = await prisma.jambaarsProfile.findMany({
      where: {
        nextEligibilityAt: {
          gte: windowStart,
          lte: now,
        },
      },
      select: {
        userId: true,
        user: { select: { id: true, firstName: true } },
      },
    });

    if (newlyEligible.length === 0) return;

    let notified = 0;

    for (const profile of newlyEligible) {
      await prisma.jambaarsProfile.update({
        where: { userId: profile.userId },
        data: { nextEligibilityAt: null },
      });

      // 2. Notifier le front si connecté
      const sent = emitToUser(profile.userId, "donor:eligible", {
        message: "Vous êtes à nouveau éligible pour donner votre sang !",
      });

      if (sent) notified++;
    }

    logger.logEvent("CRON_ELIGIBILITY_NOTIFIED", {
      total: newlyEligible.length,
      notified,
      skipped: newlyEligible.length - notified,
    });
  } catch (err) {
    logger.error({ err }, "Erreur CRON eligibilityJob");
  }
};
