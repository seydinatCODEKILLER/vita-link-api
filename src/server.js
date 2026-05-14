import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";
import logger from "./config/logger.js";
import { initSocket } from "./config/socket.js";
import { startCronJobs } from "./jobs/index.js";

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connecté via Prisma");

    // Créer le serveur HTTP à partir d'Express
    const httpServer = createServer(app);

    // Initialiser Socket.io sur le même serveur HTTP
    const io = initSocket(httpServer);

    startCronJobs();

    httpServer.listen(env.PORT, "0.0.0.0", () => {
      logger.info(`Vital-Link API démarrée sur http://localhost:${env.PORT}`);
      logger.info(`Swagger docs : http://localhost:${env.PORT}/api/docs`);
      logger.info(`Environnement : ${env.NODE_ENV}`);
    });

    const shutdown = async (signal) => {
      logger.warn(`Signal ${signal} reçu — arrêt en cours...`);

      io.disconnectSockets(true);
      io.close();

      httpServer.close(async () => {
        await prisma.$disconnect();
        logger.info("Serveur arrêté proprement");
        process.exit(0);
      });

      setTimeout(() => {
        logger.error("Arrêt forcé après timeout de 10s");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("unhandledRejection", (reason) => {
      logger.error({ reason }, "Unhandled promise rejection");
    });

    process.on("uncaughtException", (err) => {
      logger.fatal({ err }, "Uncaught exception — arrêt forcé");
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, "Erreur de démarrage");
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
