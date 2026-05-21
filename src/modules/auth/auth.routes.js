import { Router } from "express";
import authController from "./auth.controller.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  authLimiter,
  registerLimiter,
  refreshTokenLimiter,
} from "../../config/rateLimiter.js";
import {
  RegisterDonorSchema,
  RegisterHealthStructureSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  LoginSchema,
  RefreshTokenSchema,
} from "./auth.schema.js";

const router = Router();

/**
 * @swagger
 * /auth/register/donor:
 *   post:
 *     summary: Pré-inscription d'un donneur (Jambaar)
 *     description: |
 *       Vérifie la disponibilité du téléphone et de l'email, puis envoie un OTP.
 *       **Le compte n'est pas encore créé** — il le sera lors de la vérification OTP.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterDonorDTO'
 *     responses:
 *       200:
 *         description: Disponibilité vérifiée et OTP envoyé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Code de vérification envoyé à votre adresse email." }
 *                 email:   { type: string, example: "aliou@gmail.com" }
 *       409:
 *         description: Conflit - Email ou téléphone déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/register/donor",
  registerLimiter,
  validate(RegisterDonorSchema),
  authController.registerDonor.bind(authController),
);

/**
 * @swagger
 * /auth/register/health-structure:
 *   post:
 *     summary: Inscription d'une structure de santé + directeur
 *     description: |
 *       "Crée simultanément le directeur et la structure en transaction atomique.
 *       La structure est en statut PENDING_REVIEW jusqu'à validation admin.
 *       Le directeur peut se connecter immédiatement mais avec accès limité."
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterHealthStructureDTO'
 *     responses:
 *       201:
 *         description: Structure soumise en attente de vérification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Inscription soumise avec succès. Votre structure est en attente de vérification par notre équipe." }
 *                 director:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "c8a8b..." }
 *                     email: { type: string, example: "dr.sow@hpd.sn" }
 *                     isStructureAdmin: { type: boolean, example: true }
 *                 structure:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "d9b9c..." }
 *                     name: { type: string, example: "Hôpital Principal de Dakar" }
 *                     region: { type: string, example: "Dakar" } # <-- AJOUT ICI
 *                     status: { type: string, example: "PENDING_REVIEW" }
 *       409:
 *         description: Conflit - Email, téléphone ou numéro d'enregistrement déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/register/health-structure",
  registerLimiter,
  validate(RegisterHealthStructureSchema),
  authController.registerHealthStructure.bind(authController),
);

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Envoi / renvoi d'un OTP par email
 *     description: Invalide les OTPs précédents et envoie un nouveau code valable 10 minutes.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "aliou@gmail.com" }
 *     responses:
 *       200:
 *         description: OTP envoyé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Code de vérification renvoyé." }
 */
router.post(
  "/otp/send",
  authLimiter,
  validate(SendOtpSchema),
  authController.sendOtp.bind(authController),
);

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Vérification OTP → Création compte donneur → JWT
 *     description: |
 *       "Vérifie le code OTP. Si valide :
 *       - Crée le compte donneur (upsert) avec toutes ses données
 *       - Crée automatiquement le profil Jambaar (0 pts, grade ASPIRANT)
 *       - Retourne un access token (15 min) + refresh token (30 jours)"
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpDTO'
 *     responses:
 *       200:
 *         description: Authentification réussie et compte Jambaar créé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Vérification réussie. Bienvenue dans la communauté Jambaar !" }
 *                 accessToken: { type: string, example: "eyJhbGciOiJI..." }
 *                 refreshToken: { type: string, example: "eyJhbGciOiJI..." }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string, format: email }
 *                     phone: { type: string }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     role: { type: string, example: "DONOR" }
 *                     bloodType: { type: string, example: "O_NEG" }
 *                     isAvailable: { type: boolean, example: true }
 *                     jambaarsProfile:
 *                       type: object
 *                       properties:
 *                         totalPoints: { type: number, example: 0 }
 *                         currentGrade: { type: string, example: "ASPIRANT" }
 *                         donationCount: { type: number, example: 0 }
 *       400:
 *         description: OTP invalide, expiré ou incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/otp/verify",
  authLimiter,
  validate(VerifyOtpSchema),
  authController.verifyOtp.bind(authController),
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion agents de santé et admins (email + mot de passe)
 *     description: |
 *       Réservé aux rôles `HEALTH_STRUCTURE` et `ADMIN`.
 *       Les donneurs utilisent le flux OTP.
 *       Implémente une protection **timing-safe** contre l'énumération d'emails.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: "dr.sow@hpd.sn" }
 *               password: { type: string, format: password, example: "Motdepasse123!" }
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string, example: "eyJhbGciOiJI..." }
 *                 refreshToken: { type: string, example: "eyJhbGciOiJI..." }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string, format: email }
 *                     firstName: { type: string, example: "Dr. Moussa" }
 *                     lastName: { type: string, example: "Sow" }
 *                     role: { type: string, example: "HEALTH_STRUCTURE" }
 *                     isStructureAdmin: { type: boolean, example: true }
 *                     healthStructureId: { type: string, example: "d9b9c..." }
 *       401:
 *         description: Identifiants invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: "Compte suspendu ou rôle non autorisé (ex: un donneur qui tente le login)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/login",
  authLimiter,
  validate(LoginSchema),
  authController.login.bind(authController),
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renouvellement de l'access token
 *     description: "Échange un refresh token valide contre un nouveau pair de tokens. Token rotation : l'ancien refresh token est révoqué immédiatement."
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, example: "eyJhbGciOiJI..." }
 *     responses:
 *       200:
 *         description: Nouveaux tokens générés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string, example: "eyJhbGciOiJI_NEW..." }
 *                 refreshToken: { type: string, example: "eyJhbGciOiJI_NEW..." }
 *       401:
 *         description: Refresh token invalide, expiré ou révoqué (attaque de rejeu)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/refresh",
  refreshTokenLimiter,
  validate(RefreshTokenSchema),
  authController.refresh.bind(authController),
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Déconnexion — révocation du refresh token
 *     description: Invalide le refresh token en base de données. L'access token expirera naturellement.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Déconnexion réussie." }
 *       401:
 *         description: Non authentifié (Access token manquant ou invalide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/logout",
  authenticate,
  authController.logout.bind(authController),
);

export default router;
