import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const PARTNER_PUBLIC_SELECT = {
  id: true,
  name: true,
  description: true,
  logoUrl: true,
  websiteUrl: true,
};

export const PARTNER_ADMIN_SELECT = {
  ...PARTNER_PUBLIC_SELECT,
  isActive: true,
  managedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  createdAt: true,
  updatedAt: true,
};

// ─── Repository ───────────────────────────────────────────────

class PartnerRepository extends BaseRepository {
  constructor() {
    super(prisma.partner);
  }

  // ─── Lecture ───────────────────────────────────────────────

  // Pour les donneurs : uniquement les actifs
  findAllActive() {
    return this.model.findMany({
      where: { isActive: true },
      select: PARTNER_PUBLIC_SELECT,
      orderBy: { name: "asc" },
    });
  }

  // Pour l'admin : tous les partenaires
  findAllForAdmin() {
    return this.model.findMany({
      select: PARTNER_ADMIN_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: PARTNER_ADMIN_SELECT, // On prend le select admin pour vérifier isActive dans le service
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  createPartner(data) {
    return this.model.create({
      data,
      select: PARTNER_ADMIN_SELECT,
    });
  }

  updatePartner(id, data) {
    return this.model.update({
      where: { id },
      data,
      select: PARTNER_ADMIN_SELECT,
    });
  }

  // Soft delete
  softDelete(id) {
    return this.model.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  findByName(name) {
    return this.model.findUnique({ where: { name } });
  }
}

export default new PartnerRepository();
