import express from "express";
import cors from "cors";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import logger from "./config/logger.js";
import { getCorsOptions } from "./config/cors.js";
import { generalLimiter } from "./config/rateLimiter.js";
import { swaggerOptions } from "./config/swagger.js";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error.middleware.js";
import { env } from "./config/env.js";

const app = express();
const specs = swaggerJSDoc({
  definition: swaggerOptions,
  apis: swaggerOptions.apis,
});

// ─── Trust proxy (DOIT être en premier) ──────────────────────
app.set("trust proxy", 1);

// ─── Middlewares globaux ──────────────────────────────────────
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Documentation Swagger ────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// ─── Rate limiter général ─────────────────────────────────────
app.use("/api", generalLimiter);

// ─── Importer les routes ──────────────────────────────────────
import authRouter from "./modules/auth/auth.routes.js";
import userRouter from "./modules/users/user.routes.js";
import healthStructureRouter from "./modules/health-structures/healthStructure.routes.js";

// ─── Routes ───────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/health-structures", healthStructureRouter);


// ─── Health check ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Vital-Link API is running",
    version: "1.0.0",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 + Error handler (toujours en dernier) ────────────────
app.all("/{*path}", notFoundHandler);
app.use(errorHandler);

logger.info(`Vital-Link API initialized — ${env.NODE_ENV}`);

export default app;