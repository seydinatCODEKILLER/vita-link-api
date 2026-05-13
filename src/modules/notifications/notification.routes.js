import { Router } from "express";
import notificationController from "./notification.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  ListMyNotificationsSchema,
  MarkAsReadSchema,
} from "./notification.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Historique et gestion des notifications push/in-app
 */

/**
 * @swagger
 * /notifications/me:
 *   get:
 *     summary: Mes notifications
 *     description: |
 *       Retourne l'historique paginé des notifications de l'utilisateur connecté.
 *       Filtrable par statut de lecture.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: "Filtrer par statut de lecture (ex: false pour les non lues)"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des notifications
 */
router.get(
  "/me",
  crudLimiter,
  validate(ListMyNotificationsSchema),
  notificationController.getMyNotifications.bind(notificationController),
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Marquer une notification comme lue
 *     description: |
 *       Passe le statut `isRead` à true.
 *       Un utilisateur ne peut marquer que ses propres notifications.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification mise à jour
 *       403:
 *         description: Notification appartenant à un autre utilisateur
 *       404:
 *         description: Notification introuvable
 */
router.patch(
  "/:id/read",
  crudLimiter,
  validate(MarkAsReadSchema),
  notificationController.markAsRead.bind(notificationController),
);

/**
 * @swagger
 * /notifications/me:
 *   delete:
 *     summary: Supprimer toutes mes notifications
 *     description: |
 *       Supprime définitivement toutes les notifications de l'utilisateur connecté.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications supprimées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:      { type: boolean }
 *                 message:      { type: string }
 *                 deletedCount: { type: integer, example: 15 }
 */
router.delete(
  "/me",
  crudLimiter,
  notificationController.deleteAllMyNotifications.bind(notificationController),
);

export default router;
