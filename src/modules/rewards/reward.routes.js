import { Router } from "express";
import rewardController from "./reward.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  CreateRewardSchema,
  UpdateRewardSchema,
  DeactivateRewardSchema,
} from "./reward.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Rewards
 *   description: Catalogue des récompenses échangeables contre des points Jambaar
 */

/**
 * @swagger
 * /rewards:
 *   get:
 *     summary: Catalogue des récompenses
 *     description: |
 *       - **Donneurs** : Retourne uniquement les récompenses actives, non expirées et en stock.
 *       - **Admins** : Retourne toutes les récompenses (y compris désactivées ou en rupture).
 *     tags: [Rewards]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des récompenses
 */
router.get(
  "/",
  crudLimiter,
  rewardController.listRewards.bind(rewardController),
);

/**
 * @swagger
 * /rewards/{id}:
 *   get:
 *     summary: Détail d'une récompense
 *     description: |
 *       Renvoie les informations d'une récompense.
 *       Si la récompense est désactivée, seuls les admins peuvent y accéder.
 *     tags: [Rewards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détails de la récompense
 *       404:
 *         description: Récompense introuvable ou désactivée
 */
router.get(
  "/:id",
  crudLimiter,
  rewardController.getRewardById.bind(rewardController),
);

/**
 * @swagger
 * /rewards:
 *   post:
 *     summary: Créer une récompense (Admin)
 *     description: |
 *       Crée une nouvelle récompense liée à un partenaire.
 *       Les donneurs pourront l'échanger contre leurs points Jambaar.
 *     tags: [Rewards]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [partnerId, title, description, pointsCost, rewardType]
 *             properties:
 *               partnerId:     { type: string, format: uuid, example: "a1b2c3d4-..." }
 *               title:         { type: string, example: "Ticket de bus gratuit" }
 *               description:   { type: string, example: "Valable 1 trajet sur la ligne Dakar-Diamniadio" }
 *               pointsCost:    { type: integer, example: 150 }
 *               rewardType:    { type: string, enum: [DISCOUNT_COUPON, TRANSPORT_TICKET, HEALTH_CHECKUP, DATA_BUNDLE, OTHER] }
 *               stockQuantity: { type: integer, example: 50 }
 *               isUnlimited:   { type: boolean, default: false }
 *               expiresAt:     { type: string, format: date-time, nullable: true }
 *     responses:
 *       201:
 *         description: Récompense créée
 *       400:
 *         description: Partenaire inexistant (P2003)
 */
router.post(
  "/",
  crudLimiter,
  requireRole("ADMIN"),
  validate(CreateRewardSchema),
  rewardController.createReward.bind(rewardController),
);

/**
 * @swagger
 * /rewards/{id}:
 *   patch:
 *     summary: Modifier une récompense (Admin)
 *     tags: [Rewards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partnerId:     { type: string, format: uuid }
 *               title:         { type: string }
 *               description:   { type: string }
 *               pointsCost:    { type: integer }
 *               rewardType:    { type: string }
 *               stockQuantity: { type: integer }
 *               isUnlimited:   { type: boolean }
 *               expiresAt:     { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Récompense mise à jour
 */
router.patch(
  "/:id",
  crudLimiter,
  requireRole("ADMIN"),
  validate(UpdateRewardSchema),
  rewardController.updateReward.bind(rewardController),
);

/**
 * @swagger
 * /rewards/{id}:
 *   delete:
 *     summary: Désactiver une récompense (Admin)
 *     description: |
 *       Passe le statut `isActive` à false. La récompense n'apparaîtra plus dans le catalogue des donneurs.
 *     tags: [Rewards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Récompense désactivée
 *       409:
 *         description: Déjà désactivée
 */
router.delete(
  "/:id",
  crudLimiter,
  requireRole("ADMIN"),
  validate(DeactivateRewardSchema),
  rewardController.deactivateReward.bind(rewardController),
);

export default router;
