import bloodStockRepository from "./bloodStock.repository.js";
import { emitToStructure, emitToAdmins } from "../../config/socket.js";
import logger from "../../config/logger.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";

class BloodStockService {
  // ── Règle métier : Calcul automatique du niveau ────────────
  _calculateStockLevel(quantity) {
    if (quantity === 0) return "CRITICAL";
    if (quantity <= 5) return "LOW";
    if (quantity <= 15) return "ADEQUATE";
    return "SURPLUS";
  }

  // ── GET /blood-stocks/me ───────────────────────────────────
  async getMyStocks(user) {
    if (!user.healthStructureId) {
      throw new ForbiddenError("Vous n'êtes rattaché à aucune structure");
    }

    return bloodStockRepository.findByStructure(user.healthStructureId);
  }

  // ── PATCH /blood-stocks/me ─────────────────────────────────
  async updateMyStock(user, data) {
    if (!user.healthStructureId) {
      throw new ForbiddenError("Vous n'êtes rattaché à aucune structure");
    }

    // ← NOUVEAU : Seule la CNTS peut modifier le stock manuellement
    if (user.employerStructure?.structureType !== "CNTS") {
      throw new ForbiddenError(
        "Seul un agent de la CNTS peut modifier le stock de sang",
      );
    }

    const { bloodType, quantity } = data;
    const level = this._calculateStockLevel(quantity);

    const stock = await bloodStockRepository.upsertStock(
      user.healthStructureId,
      bloodType,
      quantity,
      level,
    );

    logger.logEvent("BLOOD_STOCK_UPDATED", {
      structureId: user.healthStructureId,
      bloodType,
      quantity,
      level,
      updatedBy: user.id,
    });

    emitToStructure(user.healthStructureId, "stock:updated", {
      bloodType,
      quantity,
      level,
    });

    if (level === "CRITICAL") {
      emitToAdmins("stock:critical", {
        structureId: user.healthStructureId,
        structureName: user.employerStructure?.name,
        bloodType,
        quantity,
      });
    }

    return stock;
  }

  // ── GET /blood-stocks (Admin) ──────────────────────────────
  async getAllStocks(filters) {
    const { data, total } =
      await bloodStockRepository.findAllWithStructure(filters);

    return {
      stocks: data,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }
}

export default new BloodStockService();
