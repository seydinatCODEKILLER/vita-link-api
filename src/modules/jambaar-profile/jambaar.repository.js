import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const JAMBAAR_PROFILE_SELECT = {
  id: true,
  totalPoints: true,
  currentGrade: true,
  donationCount: true,
  livesSavedEstimate: true,
  noShowCount: true,
  lastDonationAt: true,
  nextEligibilityAt: true,
  city: true,
  district: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bloodType: true,
    },
  },
};

export const LEADERBOARD_SELECT = {
  totalPoints: true,
  currentGrade: true,
  donationCount: true,
  livesSavedEstimate: true,
  city: true,
  district: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bloodType: true,
    },
  },
};

export const BADGE_SELECT = {
  earnedAt: true,
  badge: {
    select: {
      id: true,
      name: true,
      description: true,
      iconUrl: true,
      criteria: true,
      isSeasonal: true,
      season: true,
    },
  },
};

// ─── Repository ───────────────────────────────────────────────

class JambaarsRepository extends BaseRepository {
  constructor() {
    super(prisma.jambaarsProfile);
  }

  // ─── Profil ────────────────────────────────────────────────

  findByUserId(userId) {
    return this.model.findUnique({
      where: { userId },
      select: JAMBAAR_PROFILE_SELECT,
    });
  }

  findUserForBadgeNotification(userId) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { bloodType: true, expoPushToken: true },
    });
  }

  // ─── Badges ────────────────────────────────────────────────

  findUserBadges(userId) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      select: BADGE_SELECT,
      orderBy: { earnedAt: "desc" },
    });
  }

  findAllBadges() {
    return this.prisma.badge.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        iconUrl: true,
        criteria: true,
        isSeasonal: true,
        season: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  awardBadges(userId, badgeIds) {
    return this.prisma.userBadge.createMany({
      data: badgeIds.map((badgeId) => ({ userId, badgeId })),
      skipDuplicates: true,
    });
  }

  // ─── Leaderboard ────────────────────────────────────────────

  /**
   * Classement paginé — global, par ville ou par quartier.
   * Les filtres sont exclusifs : district > city > global.
   */
  findLeaderboard({ city, district, page, limit }) {
    const where = {
      // On n'inclut que les profils avec au moins un don
      donationCount: { gt: 0 },
      ...(district
        ? { district: { equals: district, mode: "insensitive" } }
        : city
          ? { city: { equals: city, mode: "insensitive" } }
          : {}),
    };

    return this.findManyWithCount(where, {
      page,
      limit,
      sort: [
        { totalPoints: "desc" },
        { donationCount: "desc" }, // départage à points égaux
      ],
      select: LEADERBOARD_SELECT,
    });
  }

  /**
   * Position du donneur dans le classement.
   * Utilisé pour afficher "Vous êtes #12 au classement de Dakar".
   */
  async getUserRank(userId, { city, district } = {}) {
    const where = {
      donationCount: { gt: 0 },
      ...(district
        ? { district: { equals: district, mode: "insensitive" } }
        : city
          ? { city: { equals: city, mode: "insensitive" } }
          : {}),
    };

    const profile = await this.model.findUnique({
      where: { userId },
      select: { totalPoints: true, donationCount: true },
    });

    if (!profile) return null;

    // Compte les profils avec plus de points (ou plus de dons à égalité)
    const rank = await this.model.count({
      where: {
        ...where,
        OR: [
          { totalPoints: { gt: profile.totalPoints } },
          {
            totalPoints: profile.totalPoints,
            donationCount: { gt: profile.donationCount },
          },
        ],
      },
    });

    return rank + 1; // rank = nombre de personnes devant + 1
  }

  // ─── Mutation badges ────────────────────────────────────────

  /**
   * Vérifie et attribue les badges débloqués après un don.
   * Appelé par donation.service après validation.
   * Retourne la liste des nouveaux badges gagnés.
   */
  async checkAndAwardBadges(userId, { donationCount, totalPoints, bloodType }) {
    // Récupérer les badges déjà obtenus pour éviter les doublons
    const existingBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const earnedIds = new Set(existingBadges.map((b) => b.badgeId));

    // Récupérer tous les badges actifs
    const allBadges = await this.findAllBadges();

    const toAward = [];

    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue;

      if (
        this._meetsCriteria(badge.criteria, {
          donationCount,
          totalPoints,
          bloodType,
        })
      ) {
        toAward.push(badge);
      }
    }

    if (toAward.length === 0) return [];

    // Créer les UserBadge en masse
    await this.prisma.userBadge.createMany({
      data: toAward.map((badge) => ({ userId, badgeId: badge.id })),
      skipDuplicates: true,
    });

    return toAward;
  }

  /**
   * Évalue si un donneur remplit les critères d'un badge.
   * Les critères sont encodés dans badge.criteria sous forme de règles JSON.
   * Ex: '{"minDonations": 1}' ou '{"minPoints": 500}' ou '{"bloodType": "O_NEG"}'
   */
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
      // Si le critère n'est pas du JSON valide, on ignore ce badge
      return false;
    }
  }
}

export default new JambaarsRepository();
