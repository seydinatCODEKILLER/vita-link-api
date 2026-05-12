import { Router } from "express";
import userController from "./user.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { sanitizeBody } from "../../shared/middlewares/sanitize.middleware.js";
import { uploadSingle } from "../../shared/middlewares/upload.middleware.js";
import { crudLimiter, uploadLimiter } from "../../config/rateLimiter.js";
import {
  UpdateProfileSchema,
  UpdateLocationSchema,
  UpdateAvailabilitySchema,
  UpdateExpoTokenSchema,
} from "./user.schema.js";

const router = Router();

// Toutes les routes /users sont protégées
router.use(authenticate);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Profil complet de l'utilisateur connecté
 *     description: |
 *       Retourne toutes les informations du profil, incluant :
 *       - Pour les **donneurs** : groupe sanguin, disponibilité, profil Jambaar (points, grade, dons)
 *       - Pour les **agents de santé** : structure employeur, statut de vérification
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil retourné avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:          { type: string }
 *                     email:       { type: string, format: email }
 *                     phone:       { type: string }
 *                     firstName:   { type: string }
 *                     lastName:    { type: string }
 *                     role:        { type: string, enum: [DONOR, HEALTH_STRUCTURE, ADMIN] }
 *                     bloodType:   { type: string, enum: [A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG] }
 *                     gender:      { type: string, enum: [MALE, FEMALE] }
 *                     isAvailable: { type: boolean }
 *                     avatarUrl:   { type: string, nullable: true }
 *                     latitude:    { type: number, nullable: true }
 *                     longitude:   { type: number, nullable: true }
 *                     jambaarsProfile:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         totalPoints:       { type: integer, example: 620 }
 *                         currentGrade:      { type: string, example: "GUERRIER" }
 *                         donationCount:     { type: integer, example: 3 }
 *                         livesSavedEstimate: { type: integer, example: 9 }
 *                         nextEligibilityAt: { type: string, format: date-time, nullable: true }
 *                     employerStructure:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:         { type: string }
 *                         name:       { type: string }
 *                         status:     { type: string }
 *                         isVerified: { type: boolean }
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Utilisateur introuvable
 */
router.get("/me", crudLimiter, userController.getMe.bind(userController));

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Mise à jour des informations du profil
 *     description: |
 *       Permet de modifier le prénom, nom, genre et date de naissance.
 *       Au moins un champ doit être fourni.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:   { type: string, example: "Aliou" }
 *               lastName:    { type: string, example: "Diallo" }
 *               gender:      { type: string, enum: [MALE, FEMALE] }
 *               dateOfBirth: { type: string, format: date, example: "1995-06-15" }
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *       400:
 *         description: Données invalides ou aucun champ fourni
 *       401:
 *         description: Non authentifié
 */
router.patch(
  "/me",
  crudLimiter,
  validate(UpdateProfileSchema),
  userController.updateProfile.bind(userController),
);

/**
 * @swagger
 * /users/me/avatar:
 *   patch:
 *     summary: Upload / remplacement de la photo de profil
 *     description: |
 *       Upload une image vers Cloudinary. Formats acceptés : JPEG, PNG, WEBP.
 *       Taille maximale : **5 MB**.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Fichier image (JPEG, PNG, WEBP — max 5 MB)
 *     responses:
 *       200:
 *         description: Avatar mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:        { type: string }
 *                     avatarUrl: { type: string, example: "https://res.cloudinary.com/vita-link/..." }
 *       400:
 *         description: Aucune image fournie ou format invalide
 *       401:
 *         description: Non authentifié
 */
router.patch(
  "/me/avatar",
  uploadLimiter,
  uploadSingle("avatar"),
  userController.updateAvatar.bind(userController),
);

/**
 * @swagger
 * /users/me/location:
 *   patch:
 *     summary: Mise à jour de la localisation du donneur
 *     description: |
 *       Met à jour latitude et longitude. Ces coordonnées sont utilisées par
 *       l'algorithme géospatial pour les alertes sanguines.
 *       Le donneur n'est inclus dans les alertes que si sa localisation est définie.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude:  { type: number, example: 14.6937, minimum: -90, maximum: 90 }
 *               longitude: { type: number, example: -17.4441, minimum: -180, maximum: 180 }
 *     responses:
 *       200:
 *         description: Localisation mise à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:   { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:        { type: string }
 *                     latitude:  { type: number }
 *                     longitude: { type: number }
 *       401:
 *         description: Non authentifié
 */
router.patch(
  "/me/location",
  crudLimiter,
  validate(UpdateLocationSchema),
  userController.updateLocation.bind(userController),
);

/**
 * @swagger
 * /users/me/availability:
 *   patch:
 *     summary: Toggle disponibilité du donneur (ON/OFF)
 *     description: |
 *       Active ou désactive la disponibilité du donneur.
 *       Un donneur **indisponible** ne reçoit pas de notifications d'alertes.
 *       Réservé au rôle **DONOR**.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isAvailable]
 *             properties:
 *               isAvailable: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Disponibilité mise à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:          { type: string }
 *                     isAvailable: { type: boolean }
 *       403:
 *         description: Réservé aux donneurs
 *       401:
 *         description: Non authentifié
 */
router.patch(
  "/me/availability",
  crudLimiter,
  validate(UpdateAvailabilitySchema),
  userController.updateAvailability.bind(userController),
);

/**
 * @swagger
 * /users/me/expo-token:
 *   patch:
 *     summary: Mise à jour du token Expo Push
 *     description: |
 *       Enregistre ou met à jour le token Expo Push Notifications.
 *       À appeler au démarrage de l'application mobile et après chaque regénération de token.
 *       Format attendu : `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expoPushToken]
 *             properties:
 *               expoPushToken:
 *                 type: string
 *                 example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
 *     responses:
 *       200:
 *         description: Token enregistré
 *       400:
 *         description: Format de token invalide
 *       401:
 *         description: Non authentifié
 */
router.patch(
  "/me/expo-token",
  crudLimiter,
  validate(UpdateExpoTokenSchema),
  userController.updateExpoToken.bind(userController),
);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Suppression (anonymisation) du compte
 *     description: |
 *       **Suppression douce (soft delete) conforme RGPD** :
 *       - Les données personnelles sont anonymisées (nom, email, téléphone, photo, localisation)
 *       - Le compte est désactivé
 *       - L'**historique des dons est conservé** pour la traçabilité médicale
 *       - Les tokens sont révoqués immédiatement
 *
 *       ⚠️ Cette action est **irréversible**.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Compte supprimé et données anonymisées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Votre compte a été supprimé. Vos données ont été anonymisées." }
 *       403:
 *         description: Les administrateurs ne peuvent pas supprimer leur compte via cette route
 *       401:
 *         description: Non authentifié
 */
router.delete("/me", crudLimiter, userController.deleteMe.bind(userController));

export default router;
