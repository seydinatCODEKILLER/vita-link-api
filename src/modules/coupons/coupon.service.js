import couponRepository from "./coupon.repository.js";
import jambaarsRepository from "../jambaar-profile/jambaar.repository.js";
import rewardRepository from "../rewards/reward.repository.js";
import { emitToUser } from "../../config/socket.js";
import { sendPushNotification } from "../../config/expo.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  AppError,
} from "../../shared/errors/AppError.js";

class CouponService {
  // ── POST /coupons/redeem/:rewardId ─────────────────────────
  async redeemReward(userId, rewardId) {
    // 1. Vérifier la récompense
    const reward = await rewardRepository.findById(rewardId);
    if (!reward) throw new NotFoundError("Récompense");
    if (!reward.isActive)
      throw new BadRequestError("Cette récompense n'est plus disponible");

    // Vérifier expiration
    if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
      throw new BadRequestError("Cette récompense a expiré");
    }

    // Vérifier stock
    if (!reward.isUnlimited && reward.stockQuantity <= 0) {
      throw new BadRequestError("Rupture de stock pour cette récompense");
    }

    // 2. Vérifier le solde de points du donneur
    const profile = await jambaarsRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError("Profil Jambaar");

    if (profile.totalPoints < reward.pointsCost) {
      throw new BadRequestError(
        `Points insuffisants. Vous avez ${profile.totalPoints} pts, mais il en faut ${reward.pointsCost}.`,
      );
    }

    // 3. Transaction atomique (déduction + génération coupon)
    let coupon;
    try {
      coupon = await couponRepository.redeemReward(
        userId,
        rewardId,
        reward.pointsCost,
        reward.isUnlimited,
      );
    } catch (error) {
      if (error.message === "STOCK_DEPLETED") {
        throw new BadRequestError(
          "Rupture de stock (quelqu'un a pris le dernier entre-temps !)",
        );
      }
      throw error;
    }

    logger.logEvent("COUPON_REDEEMED", {
      couponId: coupon.id,
      userId,
      rewardId,
      pointsSpent: reward.pointsCost,
    });

    // 4. Notifier le donneur
    emitToUser(userId, "coupon:earned", { coupon });

    // Push notif (fire-and-forget)
    this._sendRedeemPush(userId, reward.title).catch((err) =>
      logger.error({ err, userId }, "Erreur push coupon"),
    );

    return coupon;
  }

  // ── GET /coupons/me ────────────────────────────────────────
  async getMyCoupons(userId, filters) {
    const { data, total } = await couponRepository.findMyCoupons(
      userId,
      filters,
    );

    return {
      coupons: data,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  // ── PATCH /coupons/:id/use ─────────────────────────────────
  async useCoupon(couponId, user) {
    const coupon = await couponRepository.findByIdWithDetails(couponId);
    if (!coupon) throw new NotFoundError("Coupon");

    // Vérification statut
    if (coupon.status === "USED")
      throw new BadRequestError("Ce coupon a déjà été utilisé");
    if (coupon.status === "EXPIRED")
      throw new BadRequestError("Ce coupon a expiré");
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new BadRequestError("Ce coupon a expiré");
    }

    // Autorisation : Seul l'Admin ou le gestionnaire du partenaire peut valider
    if (user.role !== "ADMIN") {
      const partnerManagerId = coupon.reward.partner?.managedByUserId;
      if (user.id !== partnerManagerId) {
        throw new ForbiddenError(
          "Vous n'êtes pas autorisé à valider ce coupon",
        );
      }
    }

    const usedCoupon = await couponRepository.markAsUsed(couponId);

    logger.logEvent("COUPON_USED", {
      couponId: usedCoupon.id,
      validatedBy: user.id,
    });

    // Notifier le donneur que son coupon a été utilisé
    emitToUser(coupon.userId, "coupon:used", { couponId: usedCoupon.id });

    return usedCoupon;
  }

  // ── Helper privé ───────────────────────────────────────────
  async _sendRedeemPush(userId, rewardTitle) {
    const user = await jambaarsRepository.findUserForBadgeNotification(userId); // Réutilise la méthode du module jambaar
    if (!user?.expoPushToken) return;

    await sendPushNotification({
      token: user.expoPushToken,
      title: "🎁 Récompense obtenue !",
      body: `Votre coupon pour "${rewardTitle}" est disponible dans votre portefeuille.`,
      data: { type: "COUPON_EARNED" },
    });
  }
}

export default new CouponService();
