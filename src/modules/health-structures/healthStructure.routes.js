import { Router } from "express";
import healthStructureController from "./healthStructure.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireRole,
  requireStructureMember,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  UpdateStructureSchema,
  AddStaffSchema,
  RemoveStaffSchema,
  GetStructureByIdSchema,
} from "./healthStructure.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /health-structures:
 *   get:
 *     summary: Liste toutes les structures (Admin)
 *     description: "Récupère la liste complète des structures avec le nombre d'agents, d'alertes et de dons associés."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 structures:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       status: { type: string, enum: [PENDING_REVIEW, VERIFIED, SUSPENDED] }
 *                       _count:
 *                         type: object
 *                         properties:
 *                           staffMembers: { type: integer }
 *                           alerts: { type: integer }
 *                           donations: { type: integer }
 *       403:
 *         description: Accès refusé (Rôle non admin)
 */
router.get(
  "/",
  requireRole("ADMIN"),
  crudLimiter,
  healthStructureController.getAll.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/me:
 *   get:
 *     summary: Récupérer ma structure de santé
 *     description: "Retourne les informations détaillées de la structure à laquelle l'agent connecté est rattaché."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Structure trouvée
 *       404:
 *         description: Agent non rattaché à une structure
 */
router.get(
  "/me",
  requireRole("HEALTH_STRUCTURE"),
  requireStructureMember,
  crudLimiter,
  healthStructureController.getMyStructure.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/me:
 *   patch:
 *     summary: Modifier les infos de ma structure
 *     description: "Réservé au directeur (isStructureAdmin = true). Permet de mettre à jour le nom, l'adresse ou la localisation."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Nouveau Nom Hôpital" }
 *               address: { type: string, example: "Rue Y, Dakar" }
 *               latitude: { type: number, example: 14.6937 }
 *               longitude: { type: number, example: -17.4441 }
 *     responses:
 *       200:
 *         description: Structure mise à jour
 *       403:
 *         description: "Action réservée au directeur de la structure"
 */
router.patch(
  "/me",
  requireRole("HEALTH_STRUCTURE"),
  requireStructureMember,
  crudLimiter,
  validate(UpdateStructureSchema),
  healthStructureController.updateMyStructure.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/me/staff:
 *   get:
 *     summary: Liste des agents de ma structure
 *     description: "Récupère tous les utilisateurs (directeur et infirmiers) rattachés à la structure."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste du personnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 staff:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       firstName: { type: string }
 *                       email: { type: string }
 *                       isStructureAdmin: { type: boolean, example: false }
 */
router.get(
  "/me/staff",
  requireRole("HEALTH_STRUCTURE"),
  requireStructureMember,
  crudLimiter,
  healthStructureController.getStaff.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/me/staff:
 *   post:
 *     summary: Ajouter un nouvel agent
 *     description: "Le directeur crée le compte d'un agent/infirmier et le rattache automatiquement à sa structure."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, phone, password]
 *             properties:
 *               firstName: { type: string, example: "Mamadou" }
 *               lastName: { type: string, example: "Diop" }
 *               email: { type: string, format: email, example: "m.diop@hpd.sn" }
 *               phone: { type: string, example: "+221771234567" }
 *               password: { type: string, format: password, example: "Motdepasse123!" }
 *               isStructureAdmin: { type: boolean, default: false, description: "Passer à true si cet agent doit devenir directeur" }
 *     responses:
 *       201:
 *         description: Agent créé avec succès
 *       409:
 *         description: Email ou téléphone déjà utilisé
 */
router.post(
  "/me/staff",
  requireRole("HEALTH_STRUCTURE"),
  requireStructureMember,
  crudLimiter,
  validate(AddStaffSchema),
  healthStructureController.addStaff.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/me/staff/{userId}:
 *   delete:
 *     summary: Retirer un agent de la structure
 *     description: "Détache l'agent de la structure (son compte n'est pas supprimé, il perd juste l'accès aux données de la structure). Le directeur ne peut pas se retirer lui-même."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agent détaché avec succès
 *       400:
 *         description: "Tentative de se retirer soi-même"
 *       404:
 *         description: Agent introuvable ou n'appartient pas à cette structure
 */
router.delete(
  "/me/staff/:userId",
  requireRole("HEALTH_STRUCTURE"),
  requireStructureMember,
  crudLimiter,
  validate(RemoveStaffSchema),
  healthStructureController.removeStaff.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/me/stats:
 *   get:
 *     summary: Statistiques de ma structure
 *     description: "Tableau de bord médical : temps de réponse moyen des Jambaars, nombre de dons validés, état des stocks de sang."
 *     tags: [Health Structures]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques calculées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalDonations: { type: integer, example: 45 }
 *                     avgResponseTimeMinutes: { type: integer, nullable: true, example: 12, description: "Temps moyen entre l'alerte et l'arrivée du donneur" }
 *                     alerts:
 *                       type: object
 *                       properties:
 *                         ACTIVE: { type: integer, example: 2 }
 *                         QUOTA_REACHED: { type: integer, example: 15 }
 *                     bloodStocks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bloodType: { type: string, example: "O_NEG" }
 *                           quantity: { type: integer, example: 5 }
 *                           level: { type: string, example: "ADEQUATE" }
 */
router.get(
  "/me/stats",
  requireRole("HEALTH_STRUCTURE"),
  requireStructureMember,
  crudLimiter,
  healthStructureController.getStats.bind(healthStructureController),
);

/**
 * @swagger
 * /health-structures/{id}:
 *   get:
 *     summary: Détail d'une structure par ID
 *     description: "Accès aux détails d'une structure spécifique (Admin et agents de santé)."
 *     tags: [Health Structures]
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
 *         description: Détails de la structure
 *       404:
 *         description: Structure introuvable
 */
router.get(
  "/:id",
  requireRole("ADMIN", "HEALTH_STRUCTURE"),
  crudLimiter,
  validate(GetStructureByIdSchema),
  healthStructureController.getById.bind(healthStructureController),
);

export default router;
