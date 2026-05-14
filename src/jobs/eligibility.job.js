import { prisma } from "../config/database.js";
import logger from "../config/logger.js";

const ELIGIBILITY_DAYS = { MALE: 90, FEMALE: 120 };

export const runEligibilityJob = async () => {
  try {
    const profiles = await prisma.jambaarsProfile.findMany({
      where: { lastDonationAt: { not: null } },
      select: { id: true, userId: true, lastDonationAt: true },
    });

    let updatedCount = 0;

    for (const profile of profiles) {
      const user = await prisma.user.findUnique({
        where: { id: profile.userId },
        select: { gender: true },
      });

      if (!user?.gender) continue;

      const days = ELIGIBILITY_DAYS[user.gender] || 90;
      const correctDate = new Date(profile.lastDonationAt);
      correctDate.setDate(correctDate.getDate() + days);

      const currentNext = profile.nextEligibilityAt?.getTime();
      if (currentNext !== correctDate.getTime()) {
        await prisma.jambaarsProfile.update({
          where: { id: profile.id },
          data: { nextEligibilityAt: correctDate },
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      logger.logEvent("CRON_ELIGIBILITY_RECALCULATED", { updatedCount });
    }
  } catch (err) {
    logger.error({ err }, "Erreur CRON eligibility");
  }
};
