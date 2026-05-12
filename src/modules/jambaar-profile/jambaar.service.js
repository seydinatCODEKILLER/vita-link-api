import jambaarsRepository from "./jambaar.repository.js";
import { emitToUser } from "../../config/socket.js";
import { sendPushNotification } from "../../config/expo.js";
import { prisma } from "../../config/database.js";
import logger from "../../config/logger.js";
import { NotFoundError, ForbiddenError } from "../../shared/errors/AppError.js";
import { GRADE_THRESHOLDS } from "../../shared/utils/points.utils.js";

class JambaarsService {
  // ── GET /jambaar/me ───────────────────────────────────────────
  async getMyProfile(userId) {
    const profile = await jambaarsRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError("Profil Jambaar");

    const progression = this._calculateProgression(
      profile.totalPoints,
      profile.currentGrade,
    );

    const globalRank = await jambaarsRepository.getUserRank(userId);
    const cityRank = profile.city
      ? await jambaarsRepository.getUserRank(userId, { city: profile.city })
      : null;

    return {
      profile,
      progression,
      ranks: { global: globalRank, city: cityRank },
    };
  }

  // ── GET /jambaar/me/badges ────────────────────────────────────
  async getMyBadges(userId) {
    const [earned, all] = await Promise.all([
      jambaarsRepository.findUserBadges(userId),
      jambaarsRepository.findAllBadges(),
    ]);

    const earnedIds = new Set(earned.map((ub) => ub.badge.id));

    const badgesWithStatus = all.map((badge) => ({
      ...badge,
      isUnlocked: earnedIds.has(badge.id),
      earnedAt: earned.find((ub) => ub.badge.id === badge.id)?.earnedAt ?? null,
    }));

    return {
      earned: earned.length,
      total: all.length,
      badges: badgesWithStatus,
    };
  }

  // ── GET /jambaar/leaderboard ──────────────────────────────────
  async getLeaderboard({ city, district, page, limit }, currentUserId) {
    const { data, total } = await jambaarsRepository.findLeaderboard({
      city,
      district,
      page,
      limit,
    });

    // Rang de l'utilisateur courant dans ce classement
    const myRank = await jambaarsRepository.getUserRank(currentUserId, {
      city,
      district,
    });

    // Ajouter le rang absolu à chaque entrée
    const ranked = data.map((entry, index) => ({
      rank: (page - 1) * limit + index + 1,
      ...entry,
    }));

    const scope = district
      ? `Quartier ${district}`
      : city
        ? `Ville de ${city}`
        : "Global";

    return {
      scope,
      leaderboard: ranked,
      myRank,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Méthode appelée par donation.service après validation ─────
  /**
   * Vérifie et attribue les badges débloqués après un don.
   * Notifie le donneur via Socket.io + push si nouveaux badges.
   * Exporté pour être appelé depuis donation.service.
   */
  async processBadgesAfterDonation(userId) {
    // 1. Récupérer les données du profil et de l'utilisateur
    const [profile, userData] = await Promise.all([
      jambaarsRepository.findByUserId(userId),
      jambaarsRepository.findUserForBadgeNotification(userId),
    ]);

    if (!profile || !userData) return [];

    const { totalPoints, donationCount } = profile;
    const { bloodType, expoPushToken } = userData;

    // 2. Récupérer les badges existants et tous les badges actifs
    const [earnedBadges, allBadges] = await Promise.all([
      jambaarsRepository.findUserBadges(userId),
      jambaarsRepository.findAllBadges(),
    ]);

    const earnedIds = new Set(earnedBadges.map((ub) => ub.badge.id));

    // 3. Évaluer les critères (Logique métier dans le SERVICE)
    const toAward = allBadges.filter((badge) => {
      if (earnedIds.has(badge.id)) return false;
      return this._meetsCriteria(badge.criteria, {
        donationCount,
        totalPoints,
        bloodType,
      });
    });

    if (toAward.length === 0) return [];

    // 4. Écrire en base de données
    await jambaarsRepository.awardBadges(
      userId,
      toAward.map((b) => b.id),
    );

    // 5. Notifications temps réel et Push
    emitToUser(userId, "badges:earned", {
      badges: toAward.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        iconUrl: b.iconUrl,
      })),
    });

    if (expoPushToken) {
      const badgeNames = toAward.map((b) => b.name).join(", ");
      sendPushNotification({
        token: expoPushToken,
        title: `🏆 Nouveau badge débloqué !`,
        body: `Vous avez obtenu : ${badgeNames}`,
        data: { type: "BADGE_EARNED", badges: toAward.map((b) => b.id) },
      }).catch((err) => logger.error({ err, userId }, "Erreur push badge"));
    }

    logger.logEvent("BADGES_AWARDED", {
      userId,
      badges: toAward.map((b) => b.name),
    });

    return toAward;
  }

  // ── Helper privé : progression vers le grade suivant ─────────
  _calculateProgression(totalPoints, currentGrade) {
    const gradesOrder = ["ASPIRANT", "SENTINELLE", "AMBASSADEUR"];
    const currentIndex = gradesOrder.indexOf(currentGrade);
    const nextGrade = gradesOrder[currentIndex + 1] || null;

    if (!nextGrade) {
      return {
        currentGrade,
        nextGrade: null,
        pointsToNext: 0,
        progressPercent: 100,
      };
    }

    const currentMin = GRADE_THRESHOLDS[currentGrade];
    const nextMin = GRADE_THRESHOLDS[nextGrade];
    const rangeSize = nextMin - currentMin;
    const pointsInRange = totalPoints - currentMin;

    const progressPercent = Math.min(
      Math.round((pointsInRange / rangeSize) * 100),
      100,
    );

    return {
      currentGrade,
      nextGrade,
      pointsToNext: Math.max(nextMin - totalPoints, 0),
      progressPercent,
    };
  }

  _meetsCriteria(criteriaJson, { donationCount, totalPoints, bloodType }) {
    try {
      const criteria = JSON.parse(criteriaJson);

      if (criteria.minDonations && donationCount < criteria.minDonations)
        return false;
      if (criteria.minPoints && totalPoints < criteria.minPoints) return false;
      if (criteria.bloodType && bloodType !== criteria.bloodType) return false;
      if (criteria.exactDonations && donationCount !== criteria.exactDonations)
        return false;

      return true;
    } catch {
      return false;
    }
  }
}

export default new JambaarsService();
