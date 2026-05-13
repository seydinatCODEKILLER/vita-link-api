import rewardRepository from "./reward.repository.js";
import logger from "../../config/logger.js";
import { NotFoundError, ConflictError } from "../../shared/errors/AppError.js";

class RewardService {
  // ── GET /rewards (Public/Donneur) ──────────────────────────
  async listAvailableRewards() {
    return rewardRepository.findAllAvailable();
  }

  // ── GET /rewards (Admin) ───────────────────────────────────
  async listAllRewards() {
    return rewardRepository.findAllForAdmin();
  }

  // ── GET /rewards/:id ───────────────────────────────────────
  async getRewardById(id, userRole) {
    const reward = await rewardRepository.findById(id);
    if (!reward) throw new NotFoundError("Récompense");

    // Si la récompense est désactivée, seul l'Admin peut la voir
    if (!reward.isActive && userRole !== "ADMIN") {
      throw new NotFoundError("Récompense");
    }

    return reward;
  }

  // ── POST /rewards ──────────────────────────────────────────
  async createReward(data) {
    // Note: L'existence du partnerId sera vérifiée automatiquement par Prisma (P2003)
    // Si on veut une erreur 404 plus propre avant la DB, on peut appeler partnerRepo.findById ici.

    const reward = await rewardRepository.createReward(data);

    logger.logEvent("REWARD_CREATED", {
      rewardId: reward.id,
      title: reward.title,
      pointsCost: reward.pointsCost,
    });

    return reward;
  }

  // ── PATCH /rewards/:id ─────────────────────────────────────
  async updateReward(id, data) {
    const existing = await rewardRepository.findById(id);
    if (!existing) throw new NotFoundError("Récompense");

    const reward = await rewardRepository.updateReward(id, data);

    logger.logEvent("REWARD_UPDATED", {
      rewardId: reward.id,
    });

    return reward;
  }

  // ── DELETE /rewards/:id ────────────────────────────────────
  async deactivateReward(id) {
    const existing = await rewardRepository.findById(id);
    if (!existing) throw new NotFoundError("Récompense");

    if (!existing.isActive) {
      throw new ConflictError("Cette récompense est déjà désactivée");
    }

    const reward = await rewardRepository.softDelete(id);

    logger.logEvent("REWARD_DEACTIVATED", {
      rewardId: reward.id,
      title: reward.title,
    });

    return reward;
  }
}

export default new RewardService();
