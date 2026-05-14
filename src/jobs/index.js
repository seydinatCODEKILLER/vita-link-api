import cron from "node-cron";
import logger from "../config/logger.js";

// Import des jobs
import { runAlertExpiryJob } from "./alertExpiry.job.js";
import { runEligibilityJob } from "./eligibility.job.js";
import { runLeaderboardJob } from "./leaderboard.job.js";
import { runTokenExpireJob } from "./tokenExpire.job.js";

export const startCronJobs = () => {
  logger.info("⏰ Initialisation des tâches cron...");

  // ─── Toutes les 5 minutes ──────────────────────────────
  // Ferme les alertes expirées
  cron.schedule("*/5 * * * *", async () => {
    await runAlertExpiryJob();
  });

  // ─── Tous les jours à 03h00 du matin ───────────────────
  // Nettoie les tokens et OTP expirés
  cron.schedule("0 3 * * *", async () => {
    await runTokenExpireJob();
  });

  // ─── Tous les dimanches à 04h00 du matin ───────────────
  // Recalcul des éligibilités (en cas de modifications manuelles)
  cron.schedule("0 4 * * 0", async () => {
    await runEligibilityJob();
  });

  // ─── Le 1er de chaque mois à 09h00 ─────────────────────
  // Snapshot du classement et éventuelle remise de prix
  cron.schedule("0 9 1 * *", async () => {
    await runLeaderboardJob();
  });

  logger.info("✅ Tâches cron programmées avec succès");
};