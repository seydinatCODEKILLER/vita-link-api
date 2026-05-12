import { Router } from "express";
import jambaarsController from "./jambaar.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { requireRole } from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import { LeaderboardSchema } from "./jambaar.schema.js";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /jambaar/me:
 *   get:
 *     summary: Mon profil Jambaar complet
 *     description: |
 *       Retourne le profil gamifié du donneur connecté :
 *       - Points, grade actuel, nombre de dons, vies sauvées estimées
 *       - **Progression** vers le grade suivant (% et points restants)
 *       - **Rang** dans le classement global et dans la ville du donneur
 *       - Prochaine date d'éligibilité au don
 *
 *       Réservé aux donneurs.
 *     tags: [Jambaar Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil Jambaar retourné
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 profile:
 *                   type: object
 *                   properties:
 *                     totalPoints:        { type: integer, example: 620 }
 *                     currentGrade:       { type: string, example: "SENTINELLE" }
 *                     donationCount:      { type: integer, example: 3 }
 *                     livesSavedEstimate: { type: integer, example: 9 }
 *                     nextEligibilityAt:  { type: string, format: date-time }
 *                     city:               { type: string, example: "Dakar" }
 *                     district:           { type: string, example: "Plateau" }
 *                 progression:
 *                   type: object
 *                   properties:
 *                     currentGrade:    { type: string, example: "SENTINELLE" }
 *                     nextGrade:       { type: string, example: "AMBASSADEUR" }
 *                     pointsToNext:    { type: integer, example: 380 }
 *                     progressPercent: { type: integer, example: 62 }
 *                 ranks:
 *                   type: object
 *                   properties:
 *                     global: { type: integer, example: 14 }
 *                     city:   { type: integer, example: 3, nullable: true }
 *       403:
 *         description: Réservé aux donneurs
 *       404:
 *         description: Profil Jambaar introuvable
 */
router.get(
  "/me",
  crudLimiter,
  requireRole("DONOR"),
  jambaarsController.getMyProfile.bind(jambaarsController),
);

/**
 * @swagger
 * /jambaar/me/badges:
 *   get:
 *     summary: Mes badges débloqués
 *     description: |
 *       Retourne tous les badges existants avec leur statut pour le donneur :
 *       - **Débloqué** : date d'obtention incluse
 *       - **Verrouillé** : critère d'obtention visible pour motiver
 *
 *       Exemples de badges :
 *       - 🩸 *Premier Pas* — Premier don effectué
 *       - ⚔️ *Guerrier* — 5 dons effectués
 *       - 🦁 *Sang Précieux* — Donneur O- ou AB-
 *       - ⚡ *Réactif* — Arrivée en moins de 30 minutes
 *     tags: [Jambaar Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Badges retournés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean }
 *                 earned:   { type: integer, example: 3, description: "Nombre de badges débloqués" }
 *                 total:    { type: integer, example: 8, description: "Nombre total de badges disponibles" }
 *                 badges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:          { type: string }
 *                       name:        { type: string, example: "Premier Pas" }
 *                       description: { type: string }
 *                       iconUrl:     { type: string, nullable: true }
 *                       criteria:    { type: string, description: "Critères JSON encodés" }
 *                       isUnlocked:  { type: boolean }
 *                       earnedAt:    { type: string, format: date-time, nullable: true }
 */
router.get(
  "/me/badges",
  crudLimiter,
  requireRole("DONOR"),
  jambaarsController.getMyBadges.bind(jambaarsController),
);

/**
 * @swagger
 * /jambaar/leaderboard:
 *   get:
 *     summary: Classement Jambaar (global, par ville ou par quartier)
 *     description: |
 *       Retourne le classement des donneurs par points, avec départage au nombre de dons.
 *       Seuls les donneurs ayant effectué au moins **1 don** apparaissent dans le classement.
 *
 *       **Scopes disponibles :**
 *       - Sans filtre → Classement **global**
 *       - `?city=Dakar` → Classement **ville de Dakar**
 *       - `?district=Plateau` → Classement **quartier Plateau**
 *       - `?city=Dakar&district=Plateau` → Classement **quartier Plateau** (district prioritaire)
 *
 *       Inclut aussi le **rang du donneur connecté** dans ce classement.
 *     tags: [Jambaar Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *         description: "Filtrer par ville (ex: Dakar, Thiès, Saint-Louis)"
 *         example: "Dakar"
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *         description: "Filtrer par quartier (ex: Plateau, Médina, HLM)"
 *         example: "Plateau"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Classement retourné
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 scope:   { type: string, example: "Ville de Dakar" }
 *                 myRank:  { type: integer, example: 3, nullable: true }
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:               { type: integer, example: 1 }
 *                       totalPoints:        { type: integer, example: 1200 }
 *                       currentGrade:       { type: string, example: "AMBASSADEUR" }
 *                       donationCount:      { type: integer, example: 8 }
 *                       livesSavedEstimate: { type: integer, example: 24 }
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:        { type: string }
 *                           firstName: { type: string }
 *                           lastName:  { type: string }
 *                           avatarUrl: { type: string, nullable: true }
 *                           bloodType: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:      { type: integer }
 *                     page:       { type: integer }
 *                     totalPages: { type: integer }
 */
router.get(
  "/leaderboard",
  crudLimiter,
  validate(LeaderboardSchema),
  jambaarsController.getLeaderboard.bind(jambaarsController),
);

export default router;
