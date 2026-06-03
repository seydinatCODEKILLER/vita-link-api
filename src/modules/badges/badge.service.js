import badgeRepository from "./badge.repository.js";
import logger from "../../config/logger.js";
import { NotFoundError, ConflictError } from "../../shared/errors/AppError.js";
import { emitToDonors } from "../../config/socket.js";

class BadgeService {
  // ── GET /badges ───────────────────────────────────────────────
  async listBadges() {
    return badgeRepository.findAllForAdmin();
  }

  // ── POST /badges ──────────────────────────────────────────────
  async createBadge(data) {
    const badge = await badgeRepository.createBadge(data);

    logger.logEvent("BADGE_CREATED", {
      badgeId: badge.id,
      name: badge.name,
    });

    // Notifie tous les donneurs connectés qu'un nouveau badge est disponible
    emitToDonors("badges:new", { badgeId: badge.id, name: badge.name });

    return badge;
  }

  // ── PATCH /badges/:id ─────────────────────────────────────────
  async updateBadge(id, data) {
    const existing = await badgeRepository.findById(id);
    if (!existing) throw new NotFoundError("Badge");

    const badge = await badgeRepository.updateBadge(id, data);

    logger.logEvent("BADGE_UPDATED", {
      badgeId: badge.id,
      updates: Object.keys(data),
    });

    // Notifie aussi en cas de mise à jour (nom, icône, critères changés)
    emitToDonors("badges:new", { badgeId: badge.id, name: badge.name });

    return badge;
  }

  // ── DELETE /badges/:id ────────────────────────────────────────
  async deactivateBadge(id) {
    const existing = await badgeRepository.findById(id);
    if (!existing) throw new NotFoundError("Badge");

    if (!existing.isActive) {
      throw new ConflictError("Ce badge est déjà désactivé");
    }

    const badge = await badgeRepository.softDelete(id);

    logger.logEvent("BADGE_DEACTIVATED", {
      badgeId: badge.id,
      name: badge.name,
    });

    // Notifie pour que les clients retirent le badge de leur liste
    emitToDonors("badges:new", { badgeId: badge.id, name: badge.name });

    return badge;
  }

  // ── PATCH /badges/:id/reactivate ─────────────────────────────
  async reactivateBadge(id) {
    const existing = await badgeRepository.findById(id);

    if (!existing) throw new NotFoundError("Badge");

    if (existing.isActive) {
      throw new ConflictError("Ce badge est déjà actif");
    }

    const badge = await badgeRepository.reactivate(id);

    logger.logEvent("BADGE_REACTIVATED", {
      badgeId: badge.id,
      name: badge.name,
    });

    // Notifie pour que les clients voient le badge réactivé
    emitToDonors("badges:new", { badgeId: badge.id, name: badge.name });

    return badge;
  }
}

export default new BadgeService();
