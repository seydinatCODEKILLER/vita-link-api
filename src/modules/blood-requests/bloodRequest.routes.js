import { Router } from "express";
import bloodRequestController from "./bloodRequest.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireRole,
  requireStructureMember,
  requireCntsRole,
  requireHospitalRole,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  CreateBloodRequestSchema,
  HandleBloodRequestSchema,
  ListBloodRequestsSchema,
  GetBloodRequestByIdSchema,
  CancelBloodRequestSchema,
} from "./bloodRequest.schema.js";

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /blood-requests:
 *   post:
 *     summary: Créer une demande de sang (Hôpital)
 *     description: |
 *       Un agent hospitalier soumet une demande de sang à la CNTS à laquelle son établissement est affilié.
 *       La CNTS est automatiquement déterminée selon l'affiliation de l'hôpital.
 *       La demande est créée avec le statut `PENDING` et la CNTS est notifiée en temps réel.
 *     tags: [Blood Requests]
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
 *                 maximum: 50
 *                 example: 3
 *               urgencyLevel:
 *                 type: string
 *                 enum: [VITAL, STANDARD]
 *                 example: "VITAL"
 *               serviceUnit:
 *                 type: string
 *                 enum: [EMERGENCY_ROOM, OPERATING_ROOM, MATERNITY, GENERAL, PEDIATRICS]
 *                 default: GENERAL
 *               clinicalContext:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Hémorragie post-opératoire, patient en état de choc."
 *     responses:
 *       201:
 *         description: Demande créée et transmise à la CNTS
 *       400:
 *         description: Données invalides ou hôpital non affilié
 *       403:
 *         description: Accès refusé (Rôle non hospitalier ou CNTS)
 */
router.post(
  "/",
  requireHospitalRole,
  requireStructureMember,
  crudLimiter,
  validate(CreateBloodRequestSchema),
  bloodRequestController.createRequest.bind(bloodRequestController),
);

/**
 * @swagger
 * /blood-requests:
 *   get:
 *     summary: Liste des demandes de sang
 *     description: |
 *       Retourne les demandes de sang en fonction du rôle de l'utilisateur connecté :
 *       - **Hôpital** : Voit uniquement les demandes émises par son établissement.
 *       - **CNTS** : Voit uniquement les demandes adressées à sa structure.
 *       - **Admin** : Voit toutes les demandes (si implémenté).
 *     tags: [Blood Requests]
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
 *           enum: [PENDING, FULFILLED, PARTIALLY_FULFILLED, ESCALATED_TO_ALERT, REJECTED, CANCELLED]
 *     responses:
 *       200:
 *         description: Liste paginée des demandes
 */
router.get(
  "/",
  requireRole("CNTS_AGENT", "CNTS_ADMIN", "HOSPITAL_AGENT", "ADMIN"),
  requireStructureMember,
  crudLimiter,
  validate(ListBloodRequestsSchema),
  bloodRequestController.getRequests.bind(bloodRequestController),
);

/**
 * @swagger
 * /blood-requests/{id}/handle:
 *   post:
 *     summary: Traiter une demande de sang (CNTS)
 *     description: |
 *       Permet à un agent de la CNTS de traiter une demande en attente (`PENDING`).
 *       Plusieurs actions sont possibles selon le stock disponible :
 *       - `FULFILL` : Le stock est suffisant, on fournit tout.
 *       - `PARTIALLY_FULFILL` : Fournir une partie et lancer une alerte donneurs pour le reste (nécessite `quantityProvided`).
 *       - `ESCALATE` : Aucun stock, lancer une alerte donneurs pour toute la quantité.
 *       - `REJECT` : La CNTS refuse la demande.
 *     tags: [Blood Requests]
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
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [FULFILL, PARTIALLY_FULFILL, ESCALATE, REJECT]
 *                 example: "PARTIALLY_FULFILL"
 *               quantityProvided:
 *                 type: integer
 *                 description: "Obligatoire si action = PARTIALLY_FULFILL"
 *                 example: 1
 *               cntsNotes:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Stock partiel disponible, recherche en cours pour le reliquat."
 *               radiusKm:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
 *                 description: "Rayon de recherche en km pour l'alerte donneurs (PARTIALLY_FULFILL et ESCALATE uniquement)"
 *                 example: 25
 *     responses:
 *       200:
 *         description: Demande traitée avec succès
 *       400:
 *         description: Action invalide, stock insuffisant ou demande non PENDING
 *       403:
 *         description: Accès refusé (La demande n'est pas adressée à votre CNTS)
 */
// ⚠️ ROUTE STATIQUE : Doit IMPÉRATIVEMENT être avant /:id
router.post(
  "/:id/handle",
  requireCntsRole,
  requireStructureMember,
  crudLimiter,
  validate(HandleBloodRequestSchema),
  bloodRequestController.handleRequest.bind(bloodRequestController),
);

/**
 * @swagger
 * /blood-requests/{id}/cancel:
 *   patch:
 *     summary: Annuler une demande de sang (Hôpital)
 *     description: |
 *       Permet à l'hôpital qui a émis la demande d'annuler celle-ci.
 *       Seules les demandes avec le statut `PENDING` peuvent être annulées.
 *     tags: [Blood Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Demande annulée avec succès
 *       400:
 *         description: La demande ne peut plus être annulée (déjà traitée)
 *       403:
 *         description: Seul l'hôpital demandeur peut annuler
 */
// ⚠️ ROUTE STATIQUE : Doit IMPÉRATIVEMENT être avant /:id
router.patch(
  "/:id/cancel",
  requireHospitalRole,
  requireStructureMember,
  crudLimiter,
  validate(CancelBloodRequestSchema),
  bloodRequestController.cancelRequest.bind(bloodRequestController),
);

/**
 * @swagger
 * /blood-requests/{id}:
 *   get:
 *     summary: Détail d'une demande de sang
 *     description: |
 *       Retourne les informations détaillées d'une demande, y compris l'hôpital demandeur,
 *       la CNTS assignée, et l'alerte associée s'il y a eu escalade.
 *       Règle d'accès : L'hôpital ne voit que ses demandes, la CNTS ne voit que les siennes.
 *     tags: [Blood Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détails de la demande
 *       403:
 *         description: Accès refusé à cette demande
 *       404:
 *         description: Demande introuvable
 */
// ⚠️ ROUTE DYNAMIQUE : Toujours en dernier des routes /:id
router.get(
  "/:id",
  requireRole("CNTS_AGENT", "CNTS_ADMIN", "HOSPITAL_AGENT", "ADMIN"),
  requireStructureMember,
  crudLimiter,
  validate(GetBloodRequestByIdSchema),
  bloodRequestController.getById.bind(bloodRequestController),
);

export default router;
