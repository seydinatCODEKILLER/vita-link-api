import { Router } from "express";
import alertController from "./alert.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireRole,
  requireStructureMember,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { alertLimiter, crudLimiter } from "../../config/rateLimiter.js";
import {
  CreateAlertSchema,
  ListNearbyAlertsSchema,
  ListStructureAlertsSchema,
  ListResponsesSchema,
} from "./alert.schema.js";

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @swagger
 * /alerts:
 *   post:
 *     summary: Créer une alerte sanguine
 *     description: |
 *       Déclenche une alerte médicale en temps réel :
 *       1. Crée l'alerte en base de données
 *       2. Identifie les donneurs compatibles dans le rayon via **Haversine SQL**
 *       3. Envoie un **broadcast Socket.io** aux donneurs connectés
 *       4. Envoie des **push notifications Expo** aux donneurs hors-ligne
 *
 *       Réservé aux agents de santé dont la structure est **vérifiée**.
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bloodType, quantityNeeded, urgencyLevel]
 *             properties:
 *               bloodType:
 *                 type: string
 *                 enum: [A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG]
 *                 example: "O_NEG"
 *               quantityNeeded:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 example: 2
 *               urgencyLevel:
 *                 type: string
 *                 enum: [VITAL, STANDARD]
 *                 example: "VITAL"
 *               serviceUnit:
 *                 type: string
 *                 enum: [EMERGENCY_ROOM, OPERATING_ROOM, MATERNITY, GENERAL, PEDIATRICS]
 *                 default: GENERAL
 *               radiusKm:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 10
 *                 example: 10
 *               address:
 *                 type: string
 *                 example: "Avenue Nelson Mandela, Dakar"
 *               latitude:
 *                 type: number
 *                 example: 14.6937
 *               longitude:
 *                 type: number
 *                 example: -17.4441
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: "Optionnel — auto-calculé selon l'urgence (VITAL: 1h, STANDARD: 4h)"
 *     responses:
 *       201:
 *         description: Alerte créée et donneurs notifiés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:        { type: boolean, example: true }
 *                 alert:          { type: object }
 *                 notifiedDonors: { type: integer, example: 12, description: "Nombre de donneurs compatibles trouvés" }
 *       400:
 *         description: Données invalides ou coordonnées manquantes
 *       403:
 *         description: Structure non vérifiée ou rôle insuffisant
 */
router.post(
  "/",
  alertLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  requireStructureMember,
  validate(CreateAlertSchema),
  alertController.createAlert.bind(alertController),
);

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: Alertes actives autour du donneur
 *     description: |
 *       Retourne les alertes actives dans un rayon donné, triées par :
 *       1. Urgence (VITAL avant STANDARD)
 *       2. Distance croissante
 *
 *       Si `lat`/`lng` ne sont pas fournis, utilise les coordonnées enregistrées dans le profil.
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: Latitude du donneur
 *         example: 14.6937
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *         description: Longitude du donneur
 *         example: -17.4441
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 15 }
 *         description: Rayon de recherche en km (max 100)
 *     responses:
 *       200:
 *         description: Liste des alertes actives à proximité
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:             { type: string }
 *                       bloodType:      { type: string }
 *                       urgencyLevel:   { type: string }
 *                       structureName:  { type: string }
 *                       address:        { type: string }
 *                       distance_km:    { type: number, example: 1.4 }
 *       400:
 *         description: Coordonnées manquantes (ni en query ni dans le profil)
 */
router.get(
  "/",
  crudLimiter,
  requireRole("DONOR"),
  validate(ListNearbyAlertsSchema),
  alertController.getNearbyAlerts.bind(alertController),
);

/**
 * @swagger
 * /alerts/my-structure:
 *   get:
 *     summary: Alertes de ma structure (Agent de santé)
 *     description: |
 *       Historique paginé des alertes émises par la structure de l'agent connecté.
 *       Filtrable par statut.
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, QUOTA_REACHED, EXPIRED, CANCELLED]
 *     responses:
 *       200:
 *         description: Liste paginée des alertes de la structure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 alerts:  { type: array }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:      { type: integer }
 *                     page:       { type: integer }
 *                     limit:      { type: integer }
 *                     totalPages: { type: integer }
 */
// ⚠️ /my-structure DOIT être déclaré AVANT /:id
// sinon Express interprète "my-structure" comme un UUID et tombe en 400
router.get(
  "/my-structure",
  crudLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  requireStructureMember,
  validate(ListStructureAlertsSchema),
  alertController.getMyStructureAlerts.bind(alertController),
);

/**
 * @swagger
 * /alerts/{id}:
 *   get:
 *     summary: Détail d'une alerte
 *     description: Retourne toutes les informations d'une alerte, accessible à tous les utilisateurs authentifiés.
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail de l'alerte
 *       404:
 *         description: Alerte introuvable
 */
router.get(
  "/:id",
  crudLimiter,
  alertController.getAlertById.bind(alertController),
);

/**
 * @swagger
 * /alerts/{id}/responses:
 *   get:
 *     summary: Réponses en temps réel d'une alerte (Dashboard médecin)
 *     description: |
 *       Retourne la liste des donneurs ayant répondu à l'alerte avec leur statut.
 *       Accessible uniquement au personnel de la structure émettrice ou aux admins.
 *
 *       Pour le temps réel, le client doit rejoindre la room Socket.io `alert:{id}`.
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Réponses et résumé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     confirmed: { type: integer, example: 3 }
 *                     arrived:   { type: integer, example: 1 }
 *                     declined:  { type: integer, example: 2 }
 *                     noShow:    { type: integer, example: 0 }
 *                 responses: { type: array }
 *       403:
 *         description: Accès refusé — autre structure
 *       404:
 *         description: Alerte introuvable
 */
router.get(
  "/:id/responses",
  crudLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  alertController.getAlertResponses.bind(alertController),
);

/**
 * @swagger
 * /alerts/{id}/close:
 *   patch:
 *     summary: Fermer manuellement une alerte
 *     description: |
 *       Passe l'alerte au statut `CANCELLED`.
 *       Émet un événement Socket.io `alert:closed` sur les rooms `alert:{id}` et `structure:{id}`.
 *       Seul le personnel de la structure émettrice ou un admin peut fermer l'alerte.
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Alerte fermée
 *       400:
 *         description: L'alerte n'est pas active (déjà fermée, expirée ou quota atteint)
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Alerte introuvable
 */
router.patch(
  "/:id/close",
  crudLimiter,
  requireRole("HEALTH_STRUCTURE", "ADMIN"),
  requireStructureMember,
  alertController.closeAlert.bind(alertController),
);

export default router;
