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

  // ← NOUVEAU : Utilisé par bloodRequestService pour vérifier le stock
  findByCntsAndType(cntsId, bloodType) {
    return this.model.findUnique({
      where: {
        healthStructureId_bloodType: {
          healthStructureId: cntsId,
          bloodType: bloodType,
        },
      },
    });
  }

  // ← NOUVEAU : Décrémentation atomique sécurisée (Empêche les quantités négatives)
  async decrement(stockId, quantityToRemove) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verrouiller la ligne pour la lecture (empêche les race conditions)
      const currentStock = await tx.bloodStock.findUnique({
        where: { id: stockId },
        select: { quantity: true },
      });

      if (!currentStock) {
        throw new Error("Stock introuvable");
      }

      if (currentStock.quantity < quantityToRemove) {
        throw new Error(
          `Stock insuffisant. Actuel: ${currentStock.quantity}, Demandé: ${quantityToRemove}`,
        );
      }

      // 2. Mettre à jour et calculer le nouveau niveau
      const newQuantity = currentStock.quantity - quantityToRemove;

      let newLevel = "SURPLUS";
      if (newQuantity === 0) newLevel = "CRITICAL";
      else if (newQuantity <= 5) newLevel = "LOW";
      else if (newQuantity <= 15) newLevel = "ADEQUATE";

      // 3. Sauvegarder
      return tx.bloodStock.update({
        where: { id: stockId },
        data: {
          quantity: newQuantity,
          level: newLevel,
          lastSuppliedAt: new Date(), // ← Mise à jour de la date de fourniture
        },
        select: STOCK_SELECT,
      });
    });
  }
}

export default new BloodStockRepository();
