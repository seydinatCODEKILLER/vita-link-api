import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const STOCK_SELECT = {
  id: true,
  bloodType: true,
  quantity: true,
  level: true,
  updatedAt: true,
};

export const STOCK_WITH_STRUCTURE_SELECT = {
  ...STOCK_SELECT,
  healthStructure: {
    select: { id: true, name: true, address: true },
  },
};

// ─── Repository ───────────────────────────────────────────────

class BloodStockRepository extends BaseRepository {
  constructor() {
    super(prisma.bloodStock);
  }

  // ─── Lecture ───────────────────────────────────────────────

  // Stocks de ma structure
  findByStructure(structureId) {
    return this.model.findMany({
      where: { healthStructureId: structureId },
      select: STOCK_SELECT,
      orderBy: { bloodType: "asc" },
    });
  }

  // Tous les stocks (Admin) avec filtre optionnel sur le niveau
  findAllWithStructure({ level, page, limit }) {
    const where = {
      ...(level && { level }),
    };

    return this.findManyWithCount(where, {
      page,
      limit,
      sort: [{ level: "asc" }, { bloodType: "asc" }],
      select: STOCK_WITH_STRUCTURE_SELECT,
    });
  }

  // ─── Mutation ──────────────────────────────────────────────

  /**
   * Upsert - Met à jour la quantité ou crée le stock s'il n'existe pas.
   * L'unicité est garantie par @@unique([healthStructureId, bloodType])
   */
  upsertStock(structureId, bloodType, quantity, level) {
    return this.prisma.bloodStock.upsert({
      where: {
        healthStructureId_bloodType: {
          healthStructureId: structureId,
          bloodType,
        },
      },
      update: { quantity, level },
      create: { healthStructureId: structureId, bloodType, quantity, level },
      select: STOCK_SELECT,
    });
  }
}

export default new BloodStockRepository();
