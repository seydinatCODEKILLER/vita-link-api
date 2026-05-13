import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const REWARD_PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  pointsCost: true,
  rewardType: true,
  isUnlimited: true,
  expiresAt: true,
  partner: {
    select: { id: true, name: true, logoUrl: true },
  },
};

export const REWARD_ADMIN_SELECT = {
  ...REWARD_PUBLIC_SELECT,
  stockQuantity: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  partner: {
    select: { id: true, name: true },
  },
};

// ─── Repository ───────────────────────────────────────────────

class RewardRepository extends BaseRepository {
  constructor() {
    super(prisma.reward);
  }

  // ─── Lecture ───────────────────────────────────────────────

  // Pour les donneurs : actives, non expirées, et (illimitées OU en stock)
  findAllAvailable() {
    return this.model.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          {
            OR: [{ isUnlimited: true }, { stockQuantity: { gt: 0 } }],
          },
        ],
      },
      select: REWARD_PUBLIC_SELECT,
      orderBy: { pointsCost: "asc" },
    });
  }

  // Pour l'admin : toutes les récompenses
  findAllForAdmin() {
    return this.model.findMany({
      select: REWARD_ADMIN_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: REWARD_ADMIN_SELECT,
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  createReward(data) {
    return this.model.create({
      data,
      select: REWARD_ADMIN_SELECT,
    });
  }

  updateReward(id, data) {
    return this.model.update({
      where: { id },
      data,
      select: REWARD_ADMIN_SELECT,
    });
  }

  // Soft delete
  softDelete(id) {
    return this.model.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, title: true, isActive: true },
    });
  }
}

export default new RewardRepository();
