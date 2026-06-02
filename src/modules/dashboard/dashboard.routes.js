import { Router } from "express";
import dashboardController from "./dashboard.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireCntsRole,
  requireHospitalRole,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  CntsDashboardSchema,
  HospitalDashboardSchema,
} from "./dashboard.schema.js";

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /dashboard/cnts:
 *   get:
 *     summary: Tableau de bord CNTS
 *     description: |
 *       Retourne les KPIs et données du dashboard pour la CNTS connectée :
 *       - **KPIs** : Demandes en attente, stock critique, alertes actives, total dons
 *       - **Stock** : État des réserves de sang de la CNTS
 *       - **Demandes** : Les dernières demandes des hôpitaux affiliés à traiter
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: recentRequestsLimit
 *         schema: { type: integer, default: 5, maximum: 20 }
 *         description: Nombre de demandes récentes à retourner
 *     responses:
 *       200:
 *         description: Données du dashboard CNTS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 dashboard:
 *                   type: object
 *                   properties:
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         pendingRequests: { type: integer, example: 4 }
 *                         criticalStocks: { type: integer, example: 2 }
 *                         activeAlerts: { type: integer, example: 1 }
 *                         totalDonations: { type: integer, example: 150 }
 *                     bloodStocks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bloodType: { type: string }
 *                           quantity: { type: integer }
 *                           level: { type: string }
 *                     recentRequests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           bloodType: { type: string }
 *                           quantityNeeded: { type: integer }
 *                           requestingHospital: { type: object }
 *       403:
 *         description: Non autorisé (Pas une CNTS)
 */
router.get(
  "/cnts",
  crudLimiter,
  requireCntsRole,
  validate(CntsDashboardSchema),
  dashboardController.getCntsDashboard.bind(dashboardController),
);

/**
 * @swagger
 * /dashboard/hospital:
 *   get:
 *     summary: Tableau de bord Hôpital
 *     description: |
 *       Retourne les KPIs et données du dashboard pour l'Hôpital connecté :
 *       - **KPIs** : Demandes en attente vers la CNTS, alertes directes, total dons
 *       - **Mes demandes** : Les dernières demandes de sang en cours
 *       - **Stock CNTS** : L'état des réserves de la CNTS d'affiliation (lecture seule)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: myRequestsLimit
 *         schema: { type: integer, default: 5, maximum: 20 }
 *         description: Nombre de mes demandes récentes à retourner
 *     responses:
 *       200:
 *         description: Données du dashboard Hôpital
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 dashboard:
 *                   type: object
 *                   properties:
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         pendingRequests: { type: integer, example: 2 }
 *                         activeDirectAlerts: { type: integer, example: 0 }
 *                         totalDonations: { type: integer, example: 45 }
 *                     myRequests:
 *                       type: array
 *                     cntsStock:
 *                       type: array
 *                       description: Stock de la CNTS affiliée (Lecture seule)
 *       403:
 *         description: Non autorisé (Pas un hôpital)
 */
router.get(
  "/hospital",
  crudLimiter,
  requireHospitalRole,
  validate(HospitalDashboardSchema),
  dashboardController.getHospitalDashboard.bind(dashboardController),
);

export default router;
