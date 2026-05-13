import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";
import { nanoid } from "nanoid";

// ─── Selects partagés ─────────────────────────────────────────

export const COUPON_SELECT = {
  id: true,
  code: true,
  status: true,
  usedAt: true,
  expiresAt: true,
  createdAt: true,
  reward: {
    select: {
      id: true,
      title: true,
      description: true,
      rewardType: true,
      partner: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
  },
};

// ─── Repository ───────────────────────────────────────────────

class CouponRepository extends BaseRepository {
  constructor() {
    super(prisma.coupon);
  }

  // ─── Lecture ───────────────────────────────────────────────

  findMyCoupons(userId, { page, limit, status }) {
    const where = {
      userId,
      ...(status && { status }),
    };

    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: COUPON_SELECT,
    });
  }

  findByIdWithDetails(id) {
    return this.model.findUnique({
      where: { id },
      select: {
        ...COUPON_SELECT,
        userId: true, // Nécessaire pour vérifier l'appartenance
        reward: {
          select: {
            ...COUPON_SELECT.reward.select,
            partnerId: true,
            partner: {
              select: {
                ...COUPON_SELECT.reward.select.partner,
                managedByUserId: true,
              },
            },
          },
        },
      },
    });
  }

  // ─── Transaction d'échange ─────────────────────────────────

  /**
   * Transaction atomique : vérifie, déduit, crée le coupon.
   * Appelée par le service après validations métier.
   */
  async redeemReward(userId, rewardId, pointsCost, isUnlimited) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Décrémenter le stock si limité
      if (!isUnlimited) {
        const updatedReward = await tx.reward.update({
          where: { id: rewardId },
          data: { stockQuantity: { decrement: 1 } },
          select: { stockQuantity: true },
        });

        // Sécurité : si le stock passe en négatif (race condition), on annule
        if (updatedReward.stockQuantity < 0) {
          throw new Error("STOCK_DEPLETED");
        }
      }

      // 2. Déduire les points Jambaar du donneur
      await tx.jambaarsProfile.update({
        where: { userId },
        data: { totalPoints: { decrement: pointsCost } },
      });

      // 3. Générer le coupon unique
      const couponCode = `JAMBAAR-${nanoid(4).toUpperCase()}-${nanoid(4).toUpperCase()}`;

      const coupon = await tx.coupon.create({
        data: {
          userId,
          rewardId,
          code: couponCode,
          status: "ACTIVE",
          // Expire dans 30 jours par défaut (ou selon règles métier)
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        select: COUPON_SELECT,
      });

      return coupon;
    });
  }

  // ─── Mutation ──────────────────────────────────────────────

  markAsUsed(id) {
    return this.model.update({
      where: { id },
      data: { status: "USED", usedAt: new Date() },
      select: COUPON_SELECT,
    });
  }
}

export default new CouponRepository();
