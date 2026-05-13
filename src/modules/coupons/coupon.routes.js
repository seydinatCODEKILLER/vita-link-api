import { Router } from "express";
import couponController from "./coupon.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  RedeemRewardSchema,
  ListMyCouponsSchema,
  UseCouponSchema,
} from "./coupon.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: Gestion des coupons et échange de points Jambaar
 */

/**
 * @swagger
 * /coupons/redeem/{rewardId}:
 *   post:
 *     summary: Échanger des points contre une récompense
 *     description: |
 *       Le donneur échange ses points Jambaar pour obtenir un coupon.
 *       **Transaction atomique** :
 *       - Vérifie le solde de points
 *       - Vérifie le stock de la récompense
 *       - Déduit les points
 *       - Décrémente le stock
 *       - Génère un code coupon unique (ex: JAMBAAR-X9K2-M4P7)
 *     tags: [Coupons]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Coupon généré avec succès
 *       400:
 *         description: Points insuffisants, rupture de stock ou récompense expirée
 *       404:
 *         description: Récompense introuvable
 */
router.post(
  "/redeem/:rewardId",
  crudLimiter,
  requireRole("DONOR"),
  validate(RedeemRewardSchema),
  couponController.redeemReward.bind(couponController),
);

/**
 * @swagger
 * /coupons/me:
 *   get:
 *     summary: Mes coupons (Donneur)
 *     description: Liste paginée des coupons du donneur connecté.
 *     tags: [Coupons]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, USED, EXPIRED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des coupons
 */
router.get(
  "/me",
  crudLimiter,
  requireRole("DONOR"),
  validate(ListMyCouponsSchema),
  couponController.getMyCoupons.bind(couponController),
);

/**
 * @swagger
 * /coupons/{id}/use:
 *   patch:
 *     summary: Valider l'utilisation d'un coupon (Partenaire / Admin)
 *     description: |
 *       Marque un coupon comme UTILISÉ.
 *       Seul le gestionnaire du partenaire concerné ou un Admin peut effectuer cette action.
 *     tags: [Coupons]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Coupon marqué comme utilisé
 *       400:
 *         description: Coupon déjà utilisé ou expiré
 *       403:
 *         description: Non autorisé (mauvais partenaire)
 */
router.patch(
  "/:id/use",
  crudLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"), // Le gestionnaire du partenaire a souvent un rôle Health_structure ou Admin
  validate(UseCouponSchema),
  couponController.useCoupon.bind(couponController),
);

export default router;
