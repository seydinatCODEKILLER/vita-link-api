import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.IS_DEV
      ? [
          { level: "query", emit: "event" },
          { level: "error", emit: "stdout" },
          { level: "warn", emit: "stdout" },
        ]
      : [
          { level: "error", emit: "stdout" },
        ],
  });

// Logs de requêtes en développement uniquement
if (env.IS_DEV) {
  prisma.$on("query", (e) => {
    console.log("\x1b[36m%s\x1b[0m", `Query: ${e.query}`);
    console.log("\x1b[36m%s\x1b[0m", `Duration: ${e.duration}ms`);
  });
}

// Réutiliser l'instance en dev (évite trop de connexions avec HMR)
if (!env.IS_PROD) {
  globalForPrisma.prisma = prisma;
}

// Déconnexion propre à l'arrêt
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});