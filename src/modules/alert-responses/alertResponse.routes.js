import { Router } from "express";
import alertResponseController from "./alertResponse.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  ConfirmResponseSchema,
  DeclineResponseSchema,
  ArrivedResponseSchema,
  NoShowResponseSchema,
} from "./alertResponse.schema.js";

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @swagger
 * /alert-responses/{alertId}/confirm:
 *   post:
 *     summary: "J'y vais — Confirmation du donneur"
 *     description: |
 *       Le donneur confirme sa venue. Génère un QR Code unique qui sera scanné par l'hôpital.
 *       Si le quota est atteint, l'alerte se ferme automatiquement.
 *     tags: [Alert Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               etaMinutes:
 *                 type: number
 *                 example: 12
 *                 description: "Temps d'arrivée estimé par le donneur (en minutes)"
 *     responses:
 *       200:
 *         description: Confirmation enregistrée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Confirmation enregistrée. Présentez ce QR Code à l'accueil de l'hôpital." }
 *                 qrCode: { type: string, example: "VITA-X9K2-M4P7" }
 *                 isQuotaReached: { type: boolean, example: false }
 *       400:
 *         description: Alerte expirée, déjà acceptée, ou donneur non éligible
 *       404:
 *         description: Alerte introuvable
 */
router.post(
  "/:alertId/confirm",
  requireRole("DONOR"),
  validate(ConfirmResponseSchema),
  alertResponseController.confirm.bind(alertResponseController),
);

/**
 * @swagger
 * /alert-responses/{alertId}/decline:
 *   post:
 *     summary: "Pas disponible — Refus du donneur"
 *     description: "Le donneur signale qu'il n'est pas disponible pour cette alerte. Son statut passe à DECLINED."
 *     tags: [Alert Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Refus enregistré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Votre refus a été pris en compte." }
 *       400:
 *         description: Aucune réponse à décliner
 */
router.post(
  "/:alertId/decline",
  requireRole("DONOR"),
  validate(DeclineResponseSchema),
  alertResponseController.decline.bind(alertResponseController),
);

/**
 * @swagger
 * /alert-responses/{alertId}/arrived:
 *   patch:
 *     summary: "Marquer l'arrivée du donneur — Agent de santé"
 *     description: |
 *       L'agent de santé confirme l'arrivée physique d'un donneur spécifique à l'hôpital.
 *       Le donneur doit avoir préalablement confirmé sa venue (statut CONFIRMED).
 *     tags: [Alert Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - donorId
 *             properties:
 *               donorId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant UUID du donneur dont l'arrivée est confirmée"
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Arrivée confirmée (en attente de validation finale via scan QR Code)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Arrivée confirmée. Scannez le QR Code du donneur." }
 *       400:
 *         description: Le donneur n'a pas confirmé sa venue au préalable
 *       404:
 *         description: Aucune réponse trouvée pour ce donneur sur cette alerte
 */
router.patch(
  "/:alertId/arrived",
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  validate(ArrivedResponseSchema),
  alertResponseController.markArrived.bind(alertResponseController),
);

/**
 * @swagger
 * /alert-responses/{alertId}/no-show:
 *   patch:
 *     summary: "Signaler une absence (No-Show) — Agent de santé"
 *     description: |
 *       L'agent de santé signale qu'un donneur ne s'est pas présenté à l'hôpital.
 *       - Passe le statut de la réponse du donneur à NO_SHOW.
 *       - Incrémente le compteur de No-Show du donneur (visible par l'Admin).
 *       - Décrémente le quota de confirmés sur l'alerte.
 *       - Si le quota de l'alerte n'est plus atteint suite à cette absence, l'alerte est automatiquement réouverte (ACTIVE).
 *     tags: [Alert Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - donorId
 *             properties:
 *               donorId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant UUID du donneur qui ne s'est pas présenté"
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Signalement enregistré et quota ajusté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Signalement enregistré. Le système va ajuster le quota de l'alerte." }
 *       400:
 *         description: Action impossible (le donneur n'avait pas confirmé)
 *       404:
 *         description: Aucune réponse trouvée pour ce donneur sur cette alerte
 */
router.patch(
  "/:alertId/no-show",
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  validate(NoShowResponseSchema),
  alertResponseController.markNoShow.bind(alertResponseController),
);

export default router;
