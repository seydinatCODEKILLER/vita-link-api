import { Router } from "express";
import donationDayController from "./donationDays.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { crudLimiter, uploadLimiter } from "../../config/rateLimiter.js";
import {
  ListMyDaysSchema,
  AdminListDaysSchema,
  CreateDaySchema,
  UpdateDaySchema,
  CancelDaySchema,
  IdParamSchema,
  AttendanceSchema,
  ListPublishedDaysSchema,
} from "./donationDays.schema.js";
import {
  requireRole,
  requireCntsRole,
} from "../../shared/middlewares/role.middleware.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Journées de Don
 *   description: Création, gestion et inscription aux journées de collecte planifiées
 */

// ─── ROUTES STATIQUES (À PLACER EN PREMIER) ──────────────────

/**
 * @swagger
 * /donation-days/my-structure:
 *   get:
 *     summary: Mes journées de don (Structure)
 *     description: |
 *       Retourne la liste paginée des journées de don créées par la structure de santé connectée.
 *       Filtrable par statut.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, CANCELLED, COMPLETED]
 *     responses:
 *       200:
 *         description: Liste des journées de la structure
 *       403:
 *         description: Accès réservé aux structures de santé
 */
router.get(
  "/my-structure",
  crudLimiter,
   requireRole("CNTS_ADMIN", "CNTS_AGENT", "HOSPITAL_AGENT"),
  validate(ListMyDaysSchema),
  donationDayController.getMyStructureDays.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days:
 *   get:
 *     summary: Journées de don disponibles (Donneur)
 *     description: |
 *       Retourne les journées publiées visibles par le donneur connecté.
 *       - Si `bloodTypesNeeded` est vide → tous les donneurs voient la journée
 *       - Si `bloodTypesNeeded` contient des groupes → seuls les donneurs correspondants voient la journée
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des journées disponibles
 *       403:
 *         description: Accès réservé aux donneurs
 */
router.get(
  "/",
  crudLimiter,
  requireRole("DONOR"),
  validate(ListPublishedDaysSchema),
  donationDayController.getPublishedDays.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/my-registrations:
 *   get:
 *     summary: Mes prochaines inscriptions (Donneur)
 *     description: |
 *       Retourne la liste paginée des futures journées de don auxquelles le donneur connecté est inscrit
 *       avec le statut `REGISTERED`.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des inscriptions à venir
 *       403:
 *         description: Accès réservé aux donneurs
 */
router.get(
  "/my-registrations",
  crudLimiter,
  requireRole("DONOR"),
  validate(ListPublishedDaysSchema),
  donationDayController.getMyRegistrations.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/admin/all:
 *   get:
 *     summary: Vue globale des journées (Admin)
 *     description: |
 *       Retourne la liste de TOUTES les journées de don du système.
 *       Filtrable par statut et par plage de dates.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, CANCELLED, COMPLETED]
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Début de la plage de dates
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Fin de la plage de dates
 *     responses:
 *       200:
 *         description: Liste globale
 *       403:
 *         description: Accès réservé aux administrateurs
 */
router.get(
  "/admin/all",
  crudLimiter,
  requireRole("ADMIN"),
  validate(AdminListDaysSchema),
  donationDayController.adminGetAllDays.bind(donationDayController),
);

// ─── CRUD JOURNÉES ───────────────────────────────────────────

/**
 * @swagger
 * /donation-days:
 *   post:
 *     summary: Créer une journée de don
 *     description: |
 *       Crée une nouvelle journée de don et la publie immédiatement (statut PUBLISHED).
 *       L'image de couverture est optionnelle et uploadée via multipart/form-data.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - address
 *               - scheduledDate
 *               - startTime
 *               - endTime
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Journée de don du 14 Juillet"
 *               description:
 *                 type: string
 *                 example: "Grande collecte ouverte à tous les groupes"
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Image de couverture (JPEG, PNG, WEBP - max 5MB)
 *               address:
 *                 type: string
 *                 example: "Place de l'Indépendance, Dakar"
 *               latitude:
 *                 type: number
 *                 example: 14.6937
 *               longitude:
 *                 type: number
 *                 example: -17.4441
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-07-14"
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "17:00"
 *               targetDonors:
 *                 type: integer
 *                 example: 100
 *               bloodTypesNeeded:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG]
 *                 example: ["O_NEG", "A_POS"]
 *                 description: Tableau vide ou absent = ouvert à tous
 *     responses:
 *       201:
 *         description: Journée créée avec succès
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Non autorisé (pas une structure de santé)
 */
router.post(
  "/",
  uploadLimiter,
  requireCntsRole,
  uploadSingle("photo"),
  validate(CreateDaySchema),
  donationDayController.createDay.bind(donationDayController),
);

// ✅ ROUTES DYNAMIQUES (APRÈS LES ROUTES STATIQUES)

/**
 * @swagger
 * /donation-days/{id}:
 *   get:
 *     summary: Détail d'une journée de don
 *     description: |
 *       Retourne les informations détaillées d'une journée, incluant le nombre de places restantes.
 *       - **Structures** : Voient le détail de leurs propres journées (quel que soit le statut).
 *       - **Donneurs** : Voient le détail uniquement si la journée est PUBLISHED.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détails de la journée
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Journée introuvable
 */
router.get(
  "/:id",
  crudLimiter,
  validate(IdParamSchema),
  donationDayController.getDayDetail.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/{id}:
 *   patch:
 *     summary: Modifier une journée de don
 *     description: |
 *       Modifie les informations d'une journée. Possible uniquement si son statut n'est ni COMPLETED ni CANCELLED
 *       et que la date de l'événement n'est pas encore passée.
 *       Permet également de remplacer l'image de couverture.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               photo: { type: string, format: binary }
 *               address: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               scheduledDate: { type: string, format: date }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               targetDonors: { type: integer }
 *               bloodTypesNeeded:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Journée mise à jour
 *       400:
 *         description: Données invalides ou journée non modifiable
 *       403:
 *         description: Non autorisé
 */
router.patch(
  "/:id",
  uploadLimiter,
  requireCntsRole,
  uploadSingle("photo"),
  validate(UpdateDaySchema),
  donationDayController.updateDay.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/{id}/cancel:
 *   patch:
 *     summary: Annuler une journée de don
 *     description: |
 *       Annule une journée avec une raison obligatoire. Les donneurs inscrits recevront une notification (prévu V2).
 *       Impossible d'annuler une journée déjà terminée (COMPLETED).
 *     tags: [Journées de Don]
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
 *             required: [cancelReason]
 *             properties:
 *               cancelReason:
 *                 type: string
 *                 example: "Contraintes logistiques imprévues"
 *     responses:
 *       200:
 *         description: Journée annulée
 *       400:
 *         description: Déjà annulée ou terminée
 *       403:
 *         description: Non autorisé
 */
router.patch(
  "/:id/cancel",
  crudLimiter,
  requireCntsRole,
  validate(CancelDaySchema),
  donationDayController.cancelDay.bind(donationDayController),
);

// ─── INSCRIPTIONS ────────────────────────────────────────────

/**
 * @swagger
 * /donation-days/{id}/registrations:
 *   get:
 *     summary: Liste des inscrits (Structure)
 *     description: |
 *       Retourne la liste des donneurs inscrits à cette journée ainsi qu'un résumé
 *       (nombre de registered, attended, no_show, cancelled).
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Liste des inscriptions et résumé
 *       403:
 *         description: Non autorisé (pas votre journée)
 */
router.get(
  "/:id/registrations",
  crudLimiter,
  requireRole("CNTS_AGENT", "CNTS_ADMIN", "HOSPITAL_AGENT", "ADMIN"),
  validate(IdParamSchema),
  donationDayController.getRegistrations.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/{id}/registrations/{registrationId}/attend:
 *   patch:
 *     summary: Marquer présence / absence (Structure)
 *     description: |
 *       Permet à la structure de santé de marquer un donneur comme ATTENDED (présent) ou NO_SHOW (absent).
 *       Impossible de changer le statut si déjà marqué.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID de la journée
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID de l'inscription
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ATTENDED, NO_SHOW]
 *                 example: "ATTENDED"
 *     responses:
 *       200:
 *         description: Statut mis à jour
 *       400:
 *         description: Déjà marqué
 *       403:
 *         description: Non autorisé
 *       404:
 *         description: Inscription introuvable
 */
router.patch(
  "/:id/registrations/:registrationId/attend",
  crudLimiter,
  requireRole("CNTS_AGENT", "CNTS_ADMIN"),
  validate(AttendanceSchema),
  donationDayController.markAttendance.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/{id}/register:
 *   post:
 *     summary: S'inscrire à une journée (Donneur)
 *     description: |
 *       Inscrit le donneur connecté à une journée de don publiée.
 *       - Un donneur ne peut s'inscrire qu'une seule fois par journée.
 *       - Vérifie qu'il reste des places disponibles (targetDonors).
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Inscription réussie
 *       400:
 *         description: Journée non publiée, passée ou plus de places
 *       403:
 *         description: Réservé aux donneurs
 *       409:
 *         description: Déjà inscrit
 */
router.post(
  "/:id/register",
  crudLimiter,
  requireRole("DONOR"),
  validate(IdParamSchema),
  donationDayController.registerDonor.bind(donationDayController),
);

/**
 * @swagger
 * /donation-days/{id}/register:
 *   delete:
 *     summary: Annuler mon inscription (Donneur)
 *     description: |
 *       Le donneur annule son inscription (Soft Delete - le statut passe à CANCELLED).
 *       Possible uniquement si son statut est encore REGISTERED et si l'annulation
 *       intervient plus de 24 heures avant le début de l'événement.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inscription annulée avec succès
 *       400:
 *         description: Impossible d'annuler (moins de 24h, ou déjà marqué présent/absent)
 *       403:
 *         description: Réservé aux donneurs
 *       404:
 *         description: Inscription introuvable
 */
router.delete(
  "/:id/register",
  crudLimiter,
  requireRole("DONOR"),
  validate(IdParamSchema),
  donationDayController.cancelDonorRegistration.bind(donationDayController),
);

// ADMIN SUSPEND

/**
 * @swagger
 * /donation-days/admin/{id}/suspend:
 *   patch:
 *     summary: Suspendre une journée (Admin)
 *     description: |
 *       Permet à un administrateur de suspendre une journée jugée frauduleuse ou non conforme.
 *       La journée passe en statut CANCELLED avec une raison automatique.
 *     tags: [Journées de Don]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Journée suspendue avec succès
 *       400:
 *         description: Journée déjà annulée ou terminée
 *       403:
 *         description: Accès réservé aux administrateurs
 *       404:
 *         description: Journée introuvable
 */
router.patch(
  "/admin/:id/suspend",
  crudLimiter,
  requireRole("ADMIN"),
  validate(IdParamSchema),
  donationDayController.adminSuspendDay.bind(donationDayController),
);

export default router;
