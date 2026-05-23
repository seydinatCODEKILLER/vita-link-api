import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const BADGE_ADMIN_SELECT = {
  id: true,
  name: true,
  description: true,
  iconUrl: true,
  criteria: true,
  isSeasonal: true,
  season: true,
  isActive: true,
  createdAt: true,
};

// ─── Repository ───────────────────────────────────────────────

class BadgeRepository extends BaseRepository {
  constructor() {
    super(prisma.badge);
  }

  // ─── Lecture ───────────────────────────────────────────────

  // L'admin voit tous les badges (actifs ET désactivés)
  findAllForAdmin() {
    return this.model.findMany({
      select: BADGE_ADMIN_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: BADGE_ADMIN_SELECT,
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  createBadge(data) {
    return this.model.create({
      data,
      select: BADGE_ADMIN_SELECT,
    });
  }

  updateBadge(id, data) {
    return this.model.update({
      where: { id },
      data,
      select: BADGE_ADMIN_SELECT,
    });
  }

  // Soft delete — on passe isActive à false
  softDelete(id) {
    return this.model.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  // Réactivation — on repasse isActive à true
  reactivate(id) {
    return this.model.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
  }
}

export default new BadgeRepository();
