import { Router } from "express";
import adminController from "./admin.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  GetUsersSchema,
  GetUserByIdSchema,
  SuspendUserSchema,
  ReactivateUserSchema,
  GetStructuresSchema,
  VerifyStructureSchema,
  SuspendStructureSchema,
  GetAuditLogsSchema,
  GetMonthlyStatsSchema,
  GetRegionStatsSchema,
  GetRecentAlertsSchema,
} from "./admin.schema.js";

const router = Router();

// Toutes les routes admin sont protégées
router.use(authenticate, requireRole("ADMIN"));

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Tableau de bord national (KPIs)
 *     description: "Récupère les indicateurs clés de performance de Vita-Link à l'échelle nationale. Données temps réel."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: KPIs calculés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 kpis:
 *                   type: object
 *                   properties:
 *                     totalDonors: { type: integer, example: 4500, description: "Nombre de donneurs actifs" }
 *                     totalStructures: { type: integer, example: 32, description: "Structures vérifiées" }
 *                     totalDonations: { type: integer, example: 1200, description: "Dons validés depuis le lancement" }
 *                     totalAlerts: { type: integer, example: 890, description: "Alertes clôturées (quota atteint)" }
 *                     avgResponseTimeMinutes: { type: number, nullable: true, example: 14.5, description: "Temps moyen entre l'alerte et l'arrivée du donneur" }
 *                     criticalStocksCount: { type: integer, example: 2, description: "Structures ayant un stock critique" }
 *                     livesSavedEstimate: { type: integer, example: 1800, description: "Estimation des vies sauvées" }
 *                     pendingStructures: { type: integer, example: 5, description: "Structures en attente de validation admin" }
 */
router.get(
  "/dashboard",
  crudLimiter,
  adminController.getDashboard.bind(adminController),
);

/**
 * @swagger
 * /admin/stats/monthly:
 *   get:
 *     summary: Statistiques mensuelles (Tendances)
 *     description: "Récupère le nombre de dons, d'alertes et l'estimation des vies sauvées par mois pour une année donnée."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           default: 2024
 *     responses:
 *       200:
 *         description: Données mensuelles
 */
router.get(
  "/stats/monthly",
  crudLimiter,
  validate(GetMonthlyStatsSchema),
  adminController.getMonthlyStats.bind(adminController),
);

/**
 * @swagger
 * /admin/stats/regions:
 *   get:
 *     summary: Données heatmap par région
 *     description: "Récupère le nombre de donneurs actifs et le niveau de demande (alertes) par ville/région géographique. Le demandLevel est normalisé de 0 à 100."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Données régionales
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       region: { type: string, example: "Dakar" }
 *                       demandLevel: { type: integer, example: 80, description: "Intensité de la demande de 0 à 100" }
 *                       donorsCount: { type: integer, example: 45, description: "Nombre de donneurs actifs dans cette zone" }
 */
router.get(
  "/stats/regions",
  crudLimiter,
  validate(GetRegionStatsSchema),
  adminController.getRegionStats.bind(adminController),
);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Annuaire des utilisateurs (Filtrage & Pagination)
 *     description: "Recherche avancée des utilisateurs par rôle, groupe sanguin, ville, et statut d'activation."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [DONOR, HEALTH_STRUCTURE, ADMIN]
 *       - in: query
 *         name: bloodType
 *         schema:
 *           type: string
 *           enum: [A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG]
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *           example: "Dakar"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Liste paginée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 total: { type: integer }
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       firstName: { type: string }
 *                       email: { type: string }
 *                       role: { type: string }
 *                       isActive: { type: boolean }
 *                       jambaarsProfile:
 *                         type: object
 *                         properties:
 *                           currentGrade: { type: string }
 *                           noShowCount: { type: integer, description: "Utile pour repérer les faux sauveurs" }
 */
router.get(
  "/users",
  crudLimiter,
  validate(GetUsersSchema),
  adminController.getUsers.bind(adminController),
);

/**
 * @swagger
 * /admin/alerts/recent:
 *   get:
 *     summary: Alertes les plus récentes
 *     description: "Récupère les dernières alertes créées sur la plateforme avec le nom de la structure et la région."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Liste des alertes récentes
 */
router.get(
  "/alerts/recent",
  crudLimiter,
  validate(GetRecentAlertsSchema),
  adminController.getRecentAlerts.bind(adminController),
);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Détail complet d'un utilisateur
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Profil utilisateur avec statistiques
 *       404:
 *         description: Utilisateur introuvable
 */
router.get(
  "/users/:id",
  crudLimiter,
  validate(GetUserByIdSchema),
  adminController.getUserById.bind(adminController),
);

/**
 * @swagger
 * /admin/users/{id}/suspend:
 *   patch:
 *     summary: Suspendre un utilisateur
 *     description: "Désactive le compte, révoque ses tokens et crée un log d'audit. Utile contre les faux donneurs (No-shows) ou faux hôpitaux."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: "Trop de No-shows consécutifs signalés par les hôpitaux" }
 *     responses:
 *       200:
 *         description: Utilisateur suspendu
 *       400:
 *         description: Utilisateur déjà suspendu
 */
router.patch(
  "/users/:id/suspend",
  crudLimiter,
  validate(SuspendUserSchema),
  adminController.suspendUser.bind(adminController),
);

/**
 * @swagger
 * /admin/users/{id}/reactivate:
 *   patch:
 *     summary: Réactiver un utilisateur suspendu
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Utilisateur réactivé
 */
router.patch(
  "/users/:id/reactivate",
  crudLimiter,
  validate(ReactivateUserSchema),
  adminController.reactivateUser.bind(adminController),
);

/**
 * @swagger
 * /admin/health-structures:
 *   get:
 *     summary: Liste des structures (avec filtres)
 *     description: "Permet de filtrer particulièrement les structures en attente de validation (PENDING_REVIEW)."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_REVIEW, VERIFIED, SUSPENDED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Liste des structures
 */
router.get(
  "/health-structures",
  crudLimiter,
  validate(GetStructuresSchema),
  adminController.getStructures.bind(adminController),
);

/**
 * @swagger
 * /admin/health-structures/{id}/verify:
 *   patch:
 *     summary: Valider une structure de santé
 *     description: "Passe le statut de la structure à VERIFIED. Le directeur et ses agents pourront alors utiliser pleinement l'application."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Structure validée avec succès
 *       404:
 *         description: Structure introuvable
 */
router.patch(
  "/health-structures/:id/verify",
  crudLimiter,
  validate(VerifyStructureSchema),
  adminController.verifyStructure.bind(adminController),
);

/**
 * @swagger
 * /admin/health-structures/{id}/suspend:
 *   patch:
 *     summary: Suspendre une structure de santé
 *     description: "Bloque l'accès à la structure et à tous ses agents. Action tracée dans les logs d'audit."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: "Agrément médical périmé" }
 *     responses:
 *       200:
 *         description: Structure suspendue
 */
router.patch(
  "/health-structures/:id/suspend",
  crudLimiter,
  validate(SuspendStructureSchema),
  adminController.suspendStructure.bind(adminController),
);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Journal des actions (Logs d'audit)
 *     description: "Historique complet des actions sensibles (suspensions, validations, alertes créées). Permet de traquer les abus."
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [USER, HEALTH_STRUCTURE, ALERT]
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           example: "USER_SUSPENDED"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Logs récupérés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 total: { type: integer }
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       action: { type: string }
 *                       details: { type: string, description: "JSON contenant par exemple la raison de la suspension" }
 *                       createdAt: { type: string, format: date-time }
 *                       user:
 *                         type: object
 *                         properties:
 *                           firstName: { type: string, description: "L'auteur de l'action (Admin)" }
 */
router.get(
  "/audit-logs",
  crudLimiter,
  validate(GetAuditLogsSchema),
  adminController.getAuditLogs.bind(adminController),
);

export default router;
