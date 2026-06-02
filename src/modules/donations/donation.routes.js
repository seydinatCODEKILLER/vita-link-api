import { Router } from "express";
import donationController from "./donation.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireRole,
  requireStructureMember,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  ScanDonationSchema,
  ListMyDonationsSchema,
  ListStructureDonationsSchema,
} from "./donation.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /donations/scan:
 *   post:
 *     summary: Scanner un QR Code → Valider le don
 *     description: |
 *       Point central du flux de donation. L'agent scanne le QR Code affiché
 *       sur le téléphone du donneur. En une transaction atomique :
 *       - Crée la **Donation** validée
 *       - Passe l'`AlertResponse` à `ARRIVED`
 *       - Crédite les **points Jambaar** (base + bonus urgence + bonus sang rare + bonus réactivité)
 *       - Calcule et applique le **nouveau grade** si seuil atteint
 *       - Met à jour `nextEligibilityAt` (90j hommes / 120j femmes)
 *       - Incrémente le **stock de sang** de la structure
 *       - Émet des événements **Socket.io** (donneur, structure, dashboard alerte)
 *       - Envoie une **push notification** au donneur
 *
 *       Réservé aux agents de santé et admins.
 *     tags: [Donations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode:
 *                 type: string
 *                 example: "VITA-X9K2-M4P7"
 *                 description: "Code scanné depuis l'écran du donneur"
 *               notes:
 *                 type: string
 *                 example: "Don sans incident"
 *               testResultsJson:
 *                 type: string
 *                 description: "Résultats d'analyse au format JSON stringifié"
 *     responses:
 *       200:
 *         description: Don validé et points crédités
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean, example: true }
 *                 message:  { type: string }
 *                 donation: { type: object }
 *                 jambaar:
 *                   type: object
 *                   properties:
 *                     pointsAwarded:    { type: integer, example: 170 }
 *                     newTotalPoints:   { type: integer, example: 790 }
 *                     newGrade:         { type: string, example: "AMBASSADEUR" }
 *                     gradeChanged:     { type: boolean, example: true }
 *                     nextEligibilityAt: { type: string, format: date-time }
 *       400:
 *         description: QR Code déjà utilisé, invalide ou donneur non confirmé
 *       403:
 *         description: QR Code appartenant à une autre structure
 *       404:
 *         description: QR Code introuvable
 */
router.post(
  "/scan",
  crudLimiter,
  requireRole("CNTS_AGENT", "CNTS_ADMIN", "HOSPITAL_AGENT", "ADMIN"),
  requireStructureMember,
  validate(ScanDonationSchema),
  donationController.scan.bind(donationController),
);

/**
 * @swagger
 * /donations/me:
 *   get:
 *     summary: Historique de mes dons (Donneur)
 *     description: |
 *       Retourne la liste paginée des dons effectués par le donneur connecté,
 *       avec les détails de chaque alerte associée.
 *     tags: [Donations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Historique des dons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:    { type: boolean }
 *                 donations:  { type: array }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:      { type: integer }
 *                     page:       { type: integer }
 *                     totalPages: { type: integer }
 */
// ⚠️ /me et /structure DOIVENT être avant /:id
router.get(
  "/me",
  crudLimiter,
  requireRole("DONOR"),
  validate(ListMyDonationsSchema),
  donationController.getMyDonations.bind(donationController),
);

/**
 * @swagger
 * /donations/structure:
 *   get:
 *     summary: Dons validés par ma structure (Agent de santé)
 *     description: |
 *       Historique paginé de tous les dons validés dans la structure de l'agent connecté.
 *       Inclut les informations sur le donneur et l'alerte associée.
 *     tags: [Donations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Historique des dons de la structure
 *       403:
 *         description: Non rattaché à une structure
 */
router.get(
  "/structure",
  crudLimiter,
  requireRole("CNTS_AGENT", "CNTS_ADMIN", "HOSPITAL_AGENT", "ADMIN"),
  requireStructureMember,
  validate(ListStructureDonationsSchema),
  donationController.getStructureDonations.bind(donationController),
);

/**
 * @swagger
 * /donations/{id}:
 *   get:
 *     summary: Détail d'un don
 *     description: |
 *       Retourne les détails complets d'un don.
 *       Un donneur ne peut consulter que ses propres dons.
 *       Les agents et admins peuvent consulter tous les dons.
 *     tags: [Donations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail du don
 *       403:
 *         description: Accès refusé (donneur consultant un don qui n'est pas le sien)
 *       404:
 *         description: Don introuvable
 */
router.get(
  "/:id",
  crudLimiter,
  donationController.getDonationById.bind(donationController),
);

export default router;
