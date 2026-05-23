import { Router } from "express";
import badgeController from "./badge.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  CreateBadgeSchema,
  UpdateBadgeSchema,
  DeactivateBadgeSchema,
  ReactivateBadgeSchema,
} from "./badge.schema.js";

const router = Router();

// Toutes les routes Badges sont réservées à l'Admin
router.use(authenticate, requireRole("ADMIN"));

/**
 * @swagger
 * tags:
 *   name: Badges
 *   description: Gestion des badges de succès (Admin)
 */

/**
 * @swagger
 * /badges:
 *   get:
 *     summary: Lister tous les badges (Admin)
 *     description: |
 *       Retourne tous les badges (actifs ET désactivés) pour l'administration.
 *     tags: [Badges]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des badges
 */
router.get("/", crudLimiter, badgeController.listBadges.bind(badgeController));

/**
 * @swagger
 * /badges:
 *   post:
 *     summary: Créer un nouveau badge
 *     description: |
 *       Crée un badge de gamification. Le champ `criteria` doit être un JSON valide
 *       qui sera évalué par le système Jambaar après chaque don.
 *
 *       **Exemples de critères JSON :**
 *       - `{"minDonations": 1}` — Premier don
 *       - `{"minDonations": 5}` — 5 dons effectués
 *       - `{"bloodType": "O_NEG"}` — Donneur O négatif
 *       - `{"minPoints": 500}` — Au moins 500 points Jambaar
 *     tags: [Badges]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, criteria]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Guerrier"
 *               description:
 *                 type: string
 *                 example: "A effectué 5 dons de sang"
 *               iconUrl:
 *                 type: string
 *                 format: url
 *                 example: "https://res.cloudinary.com/demo/vita-link/badges/guerrier.png"
 *               criteria:
 *                 type: string
 *                 description: "Règles d'obtention encodées en JSON stringifié"
 *                 example: "{\"minDonations\": 5}"
 *               isSeasonal:
 *                 type: boolean
 *                 default: false
 *               season:
 *                 type: string
 *                 example: "Ramadan 2024"
 *     responses:
 *       201:
 *         description: Badge créé avec succès
 *       400:
 *         description: Critères JSON invalides
 */
router.post(
  "/",
  crudLimiter,
  validate(CreateBadgeSchema),
  badgeController.createBadge.bind(badgeController),
);

/**
 * @swagger
 * /badges/{id}:
 *   patch:
 *     summary: Modifier un badge existant
 *     tags: [Badges]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *               iconUrl:     { type: string, format: url }
 *               criteria:    { type: string, description: "JSON stringifié" }
 *               isSeasonal:  { type: boolean }
 *               season:      { type: string }
 *     responses:
 *       200:
 *         description: Badge mis à jour
 *       404:
 *         description: Badge introuvable
 */
router.patch(
  "/:id",
  crudLimiter,
  validate(UpdateBadgeSchema),
  badgeController.updateBadge.bind(badgeController),
);

/**
 * @swagger
 * /badges/{id}:
 *   delete:
 *     summary: Désactiver un badge (Soft delete)
 *     description: |
 *       Passe le statut `isActive` du badge à `false`.
 *       Il n'apparaîtra plus dans la liste des badges à débloquer pour les donneurs,
 *       mais les donneurs l'ayant déjà obtenu le conservent.
 *     tags: [Badges]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Badge désactivé
 *       404:
 *         description: Badge introuvable
 *       409:
 *         description: Le badge est déjà désactivé
 */
router.delete(
  "/:id",
  crudLimiter,
  validate(DeactivateBadgeSchema),
  badgeController.deactivateBadge.bind(badgeController),
);

/**
 * @swagger
 * /badges/{id}/reactivate:
 *   patch:
 *     summary: Réactiver un badge désactivé
 *     description: |
 *       Réactive un badge précédemment désactivé en remettant
 *       le champ `isActive` à `true`.
 *
 *       Une fois réactivé :
 *       - le badge redevient visible dans le système
 *       - les utilisateurs pourront à nouveau le débloquer
 *       - les anciens détenteurs conservent leur badge
 *     tags: [Badges]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID du badge à réactiver
 *     responses:
 *       200:
 *         description: Badge réactivé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 badge:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                       example: Guerrier
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Badge introuvable
 *       409:
 *         description: Le badge est déjà actif
 */
router.patch(
  "/:id/reactivate",
  crudLimiter,
  validate(ReactivateBadgeSchema),
  badgeController.reactivateBadge.bind(badgeController),
);

export default router;
