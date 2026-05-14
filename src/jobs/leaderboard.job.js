import { prisma } from "../config/database.js";
import logger from "../config/logger.js";

export const runLeaderboardJob = async () => {
  try {
    const topDonors = await prisma.jambaarsProfile.findMany({
      where: { donationCount: { gt: 0 } },
      take: 3,
      orderBy: [{ totalPoints: "desc" }],
      select: {
        totalPoints: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    logger.logEvent("CRON_LEADERBOARD_SNAPSHOT", {
      message: "Top 3 des donneurs du moment",
      top: topDonors.map(d => `${d.user.firstName} (${d.totalPoints} pts)`),
    });

    // ICI: Tu pourrais déclencher l'envoi d'emails via Brevo aux gagnants du mois
  } catch (err) {
    logger.error({ err }, "Erreur CRON leaderboard");
  }
};