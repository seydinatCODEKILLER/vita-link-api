import { Router } from "express";
import bloodStockController from "./bloodStock.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireRole,
  requireStructureMember,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  UpdateMyStockSchema,
  ListAllStocksSchema,
} from "./bloodStock.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Blood Stocks
 *   description: Gestion des stocks de poches de sang par structure
 */

/**
 * @swagger
 * /blood-stocks/me:
 *   get:
 *     summary: Stock de sang de ma structure (Agent santé)
 *     description: Retourne l'état des stocks pour les 8 groupes sanguins de la structure connectée.
 *     tags: [Blood Stocks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: État des stocks
 */
router.get(
  "/me",
  crudLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  requireStructureMember,
  bloodStockController.getMyStocks.bind(bloodStockController),
);

/**
 * @swagger
 * /blood-stocks/me:
 *   patch:
 *     summary: Mettre à jour un stock manuellement (Agent santé)
 *     description: |
 *       Permet à l'agent de santé de mettre à jour la quantité de poches disponibles pour un groupe sanguin.
 *       Le système **calcule automatiquement le niveau d'alerte** associé :
 *       - **0** → CRITICAL
 *       - **1 à 5** → LOW
 *       - **6 à 15** → ADEQUATE
 *       - **16+** → SURPLUS
 *
 *       Émet un événement Socket.io `stock:updated` à la structure.
 *       Si CRITICAL, émet `stock:critical` aux admins globaux.
 *     tags: [Blood Stocks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bloodType, quantity]
 *             properties:
 *               bloodType:
 *                 type: string
 *                 enum: [A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG]
 *                 example: "O_NEG"
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *                 example: 4
 *     responses:
 *       200:
 *         description: Stock mis à jour
 *       403:
 *         description: Non rattaché à une structure
 */
router.patch(
  "/me",
  crudLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  requireStructureMember,
  validate(UpdateMyStockSchema),
  bloodStockController.updateMyStock.bind(bloodStockController),
);

/**
 * @swagger
 * /blood-stocks:
 *   get:
 *     summary: Stocks de toutes les structures (Admin)
 *     description: |
 *       Vue globale pour l'administrateur de tous les stocks de sang.
 *       Filtrable par niveau d'alerte (ex: que les stocks CRITICAL).
 *     tags: [Blood Stocks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [CRITICAL, LOW, ADEQUATE, SURPLUS]
 *         description: "Filtrer par niveau de stock"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Liste paginée des stocks
 */
router.get(
  "/",
  crudLimiter,
  requireRole("ADMIN"),
  validate(ListAllStocksSchema),
  bloodStockController.getAllStocks.bind(bloodStockController),
);

export default router;
