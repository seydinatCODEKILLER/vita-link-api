import { Router } from "express";
import partnerController from "./partner.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  DeactivatePartnerSchema,
} from "./partner.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Partners
 *   description: Gestion des partenaires commerciaux (Offres Jambaar)
 */

/**
 * @swagger
 * /partners:
 *   get:
 *     summary: Liste des partenaires
 *     description: |
 *       - **Donneurs** : Retourne uniquement les partenaires actifs.
 *       - **Admins** : Retourne tous les partenaires (actifs et désactivés).
 *     tags: [Partners]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des partenaires
 */
router.get(
  "/",
  crudLimiter,
  partnerController.listPartners.bind(partnerController),
);

/**
 * @swagger
 * /partners/{id}:
 *   get:
 *     summary: Détail d'un partenaire
 *     description: |
 *       Renvoie les informations d'un partenaire.
 *       Si le partenaire est désactivé, seuls les admins peuvent y accéder.
 *     tags: [Partners]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détails du partenaire
 *       404:
 *         description: Partenaire introuvable ou désactivé
 */
router.get(
  "/:id",
  crudLimiter,
  partnerController.getPartnerById.bind(partnerController),
);

/**
 * @swagger
 * /partners:
 *   post:
 *     summary: Ajouter un nouveau partenaire (Admin)
 *     tags: [Partners]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: "Orange Sonatel" }
 *               description: { type: string, example: "Leader des télécoms au Sénégal" }
 *               logoUrl:     { type: string, format: url, example: "https://res.cloudinary.com/demo/vita-link/orange.png" }
 *               websiteUrl:  { type: string, format: url, example: "https://www.sonatel.sn" }
 *     responses:
 *       201:
 *         description: Partenaire créé
 *       403:
 *         description: Accès refusé
 */
router.post(
  "/",
  crudLimiter,
  requireRole("ADMIN"),
  validate(CreatePartnerSchema),
  partnerController.createPartner.bind(partnerController),
);

/**
 * @swagger
 * /partners/{id}:
 *   patch:
 *     summary: Modifier un partenaire (Admin)
 *     tags: [Partners]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *               logoUrl:     { type: string, format: url }
 *               websiteUrl:  { type: string, format: url }
 *     responses:
 *       200:
 *         description: Partenaire mis à jour
 */
router.patch(
  "/:id",
  crudLimiter,
  requireRole("ADMIN"),
  validate(UpdatePartnerSchema),
  partnerController.updatePartner.bind(partnerController),
);

/**
 * @swagger
 * /partners/{id}:
 *   delete:
 *     summary: Désactiver un partenaire (Admin)
 *     description: |
 *       Passe le statut `isActive` à false. Le partenaire n'apparaîtra plus pour les donneurs,
 *       mais l'Admin peut toujours le consulter.
 *     tags: [Partners]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Partenaire désactivé
 *       409:
 *         description: Déjà désactivé
 */
router.delete(
  "/:id",
  crudLimiter,
  requireRole("ADMIN"),
  validate(DeactivatePartnerSchema),
  partnerController.deactivatePartner.bind(partnerController),
);

export default router;
