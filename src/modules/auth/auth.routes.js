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
  SendOtpSchema,
  VerifyOtpSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterCntsSchema,
  RegisterHospitalSchema,
} from "./auth.schema.js";
import healthStructureController from "../health-structures/healthStructure.controller.js";

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
 * /auth/register/cnts:
 *   post:
 *     summary: Inscription d'un Centre National de Transfusion Sanguine (CNTS)
 *     description: |
 *       Crée le compte d'une CNTS (autorité centrale du sang) ainsi que le compte de son directeur administratif.
 *       - Le directeur reçoit automatiquement le rôle `CNTS_ADMIN`.
 *       - Le stock sanguin de la CNTS est initialisé à 0 pour les 8 groupes sanguins.
 *       - La structure est créée avec le statut `PENDING_REVIEW` en attente de validation par un Super Admin.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *               - structureName
 *               - registrationNumber
 *               - address
 *               - region
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "Dr. Aminata"
 *               lastName:
 *                 type: string
 *                 example: "Diop"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin.cnts@transfusion.sn"
 *               phone:
 *                 type: string
 *                 example: "+221338000000"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "CntsSecure2024!"
 *               structureName:
 *                 type: string
 *                 example: "Centre National de Transfusion Sanguine de Dakar"
 *               registrationNumber:
 *                 type: string
 *                 example: "CNTS-DKR-001"
 *               address:
 *                 type: string
 *                 example: "Avenue Blaise Diagne, Dakar"
 *               region:
 *                 type: string
 *                 description: Région administrative du Sénégal
 *                 enum:
 *                   - Dakar
 *                   - Diourbel
 *                   - Fatick
 *                   - Kaffrine
 *                   - Kaolack
 *                   - Kédougou
 *                   - Kolda
 *                   - Louga
 *                   - Matam
 *                   - Sédhiou
 *                   - Saint-Louis
 *                   - Tambacounda
 *                   - Thiès
 *                   - Ziguinchor
 *                 example: "Dakar"
 *               structurePhone:
 *                 type: string
 *                 example: "+221338000001"
 *               structureEmail:
 *                 type: string
 *                 format: email
 *                 example: "contact@cnts-dakar.sn"
 *               latitude:
 *                 type: number
 *                 example: 14.6937
 *               longitude:
 *                 type: number
 *                 example: -17.4441
 *     responses:
 *       201:
 *         description: CNTS et son directeur créés avec succès (en attente de vérification)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "CNTS inscrite avec succès. En attente de vérification par l'administration."
 *                 director:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "uuid-director" }
 *                     email: { type: string, example: "admin.cnts@transfusion.sn" }
 *                     role: { type: string, example: "CNTS_ADMIN" }
 *                     isStructureAdmin: { type: boolean, example: true }
 *                 structure:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "uuid-structure" }
 *                     name: { type: string, example: "Centre National de Transfusion Sanguine de Dakar" }
 *                     structureType: { type: string, example: "CNTS" }
 *                     status: { type: string, example: "PENDING_REVIEW" }
 *       409:
 *         description: Conflit - Email, téléphone ou numéro d'enregistrement déjà utilisé
 *       400:
 *         description: Erreur de validation des données
 */
router.post(
  "/register/cnts",
  registerLimiter,
  validate(RegisterCntsSchema),
  authController.registerCnts.bind(authController),
);

/**
 * @swagger
 * /health-structures/cnts/available:
 *   get:
 *     summary: Liste des CNTS disponibles pour affiliation
 *     description: Retourne la liste des CNTS vérifiées et actives. Utilisé lors de l'inscription d'un hôpital.
 *     tags: [Health Structures]
 *     security: []
 *     responses:
 *       200:
 *         description: Liste des CNTS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, example: "uuid-cnts" }
 *                       name: { type: string, example: "CNTS de Dakar" }
 *                       region: { type: string, example: "Dakar" }
 *                       address: { type: string, example: "Avenue Blaise Diagne" }
 */
router.get(
  "/cnts/available",
  healthStructureController.getAvailableCnts.bind(healthStructureController),
);

/**
 * @swagger
 * /auth/register/hospital:
 *   post:
 *     summary: Inscription d'un Hôpital ou Centre de Santé
 *     description: |
 *       Crée le compte d'un établissement de soins (Hôpital/Clinique) et de son directeur.
 *       - Le directeur reçoit le rôle `HOSPITAL_AGENT` avec les droits d'administration de la structure.
 *       - **Règle métier fondamentale** : L'établissement DOIT obligatoirement être affilié à une CNTS existante (`affiliatedCntsId`). Sans cela, l'inscription est rejetée.
 *       - Aucun stock sanguin n'est initialisé pour cette structure (la gestion du stock est du ressort de la CNTS affiliée).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *               - structureName
 *               - registrationNumber
 *               - address
 *               - region
 *               - structureType
 *               - affiliatedCntsId
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "Dr. Moussa"
 *               lastName:
 *                 type: string
 *                 example: "Sow"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "dr.sow@hpd.sn"
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Motdepasse123!"
 *               structureName:
 *                 type: string
 *                 example: "Hôpital Principal de Dakar"
 *               registrationNumber:
 *                 type: string
 *                 example: "SN-MED-2024-001"
 *               address:
 *                 type: string
 *                 example: "Avenue Nelson Mandela, Dakar"
 *               region:
 *                 type: string
 *                 description: Région administrative du Sénégal
 *                 enum:
 *                   - Dakar
 *                   - Diourbel
 *                   - Fatick
 *                   - Kaffrine
 *                   - Kaolack
 *                   - Kédougou
 *                   - Kolda
 *                   - Louga
 *                   - Matam
 *                   - Sédhiou
 *                   - Saint-Louis
 *                   - Tambacounda
 *                   - Thiès
 *                   - Ziguinchor
 *                 example: "Dakar"
 *               structureType:
 *                 type: string
 *                 description: Type d'établissement de soins
 *                 enum:
 *                   - HOSPITAL
 *                   - HEALTH_CENTER
 *                 example: "HOSPITAL"
 *               affiliatedCntsId:
 *                 type: string
 *                 format: uuid
 *                 description: "OBLIGATOIRE : L'UUID de la CNTS de rattachement. Doit exister en base de données."
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               structurePhone:
 *                 type: string
 *                 example: "+221338201234"
 *               structureEmail:
 *                 type: string
 *                 format: email
 *                 example: "contact@hpd.sn"
 *               latitude:
 *                 type: number
 *                 example: 14.6937
 *               longitude:
 *                 type: number
 *                 example: -17.4441
 *     responses:
 *       201:
 *         description: Établissement de soins et son directeur créés avec succès (en attente de vérification)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Hôpital inscrit avec succès. En attente de vérification."
 *                 director:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "uuid-director" }
 *                     email: { type: string, example: "dr.sow@hpd.sn" }
 *                     role: { type: string, example: "HOSPITAL_AGENT" }
 *                     isStructureAdmin: { type: boolean, example: true }
 *                 structure:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "uuid-structure" }
 *                     name: { type: string, example: "Hôpital Principal de Dakar" }
 *                     structureType: { type: string, example: "HOSPITAL" }
 *                     affiliatedCntsId: { type: string, example: "a1b2c3d4..." }
 *                     status: { type: string, example: "PENDING_REVIEW" }
 *       404:
 *         description: La CNTS d'affiliation spécifiée est introuvable
 *       409:
 *         description: Conflit - Email, téléphone ou numéro d'enregistrement déjà utilisé
 *       400:
 *         description: "Erreur de validation (ex: affiliatedCntsId manquant)"
 */
router.post(
  "/register/hospital",
  registerLimiter,
  validate(RegisterHospitalSchema),
  authController.registerHospital.bind(authController),
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
