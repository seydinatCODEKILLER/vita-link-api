import adminRepository from "./admin.repository.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../shared/errors/AppError.js";
import { emitToStructure } from "../../config/socket.js";

class AdminService {
  // ── GET /admin/dashboard ─────────────────────────────────────
  async getDashboard() {
    return adminRepository.getDashboardKpis();
  }

  // ── GET /admin/stats/monthly ──────────────────────────────────
  async getMonthlyStats(year) {
    const currentYear = new Date().getFullYear();
    const targetYear = year || currentYear;

    if (targetYear < 2020 || targetYear > currentYear) {
      throw new BadRequestError(
        `Année invalide. L'année doit être comprise entre 2020 et ${currentYear}.`,
      );
    }

    return adminRepository.getMonthlyStats(targetYear);
  }

  // ── GET /admin/stats/regions ──────────────────────────────────
  async getRegionStats() {
    return adminRepository.getRegionStats();
  }

  // ── GET /admin/alerts/recent ──────────────────────────────── <-- AJOUT
  async getRecentAlerts(limit) {
    return adminRepository.getRecentAlerts(limit);
  }

  // ── GET /admin/users ─────────────────────────────────────────
  async getUsers(filters) {
    return adminRepository.findUsers(filters);
  }

  // ── GET /admin/users/:id ──────────────────────────────────────
  async getUserById(id) {
    const user = await adminRepository.findUserById(id);
    if (!user) throw new NotFoundError("Utilisateur introuvable");
    return user;
  }

  // ── PATCH /admin/users/:id/suspend ───────────────────────────
  async suspendUser(targetId, adminId, reason) {
    const user = await adminRepository.findUserById(targetId);
    if (!user) throw new NotFoundError("Utilisateur introuvable");
    if (!user.isActive)
      throw new BadRequestError("Cet utilisateur est déjà suspendu");

    const updated = await adminRepository.suspendUser(
      targetId,
      adminId,
      reason,
    );

    logger.logEvent("ADMIN_USER_SUSPENDED", { targetId, adminId, reason });
    return updated;
  }

  // ── PATCH /admin/users/:id/reactivate ────────────────────────
  async reactivateUser(targetId, adminId) {
    const user = await adminRepository.findUserById(targetId);
    if (!user) throw new NotFoundError("Utilisateur introuvable");
    if (user.isActive)
      throw new BadRequestError("Cet utilisateur est déjà actif");

    const updated = await adminRepository.reactivateUser(targetId, adminId);

    logger.logEvent("ADMIN_USER_REACTIVATED", { targetId, adminId });
    return updated;
  }

  // ── GET /admin/health-structures ─────────────────────────────
  async getStructures(filters) {
    return adminRepository.findStructures(filters);
  }

  // ── PATCH /admin/health-structures/:id/verify ─────────────────
  async verifyStructure(id, adminId) {
    const existing = await adminRepository.findStructureById(id);
    if (!existing) throw new NotFoundError("Structure introuvable");

    // ← NOUVEAU : Vérification métier selon le type de structure
    if (
      existing.structureType === "HOSPITAL" ||
      existing.structureType === "HEALTH_CENTER"
    ) {
      if (!existing.affiliatedCntsId) {
        throw new BadRequestError(
          "Impossible de vérifier cet hôpital : il n'est affilié à aucune CNTS. Veuillez d'abord l'affilier via le tableau de bord ou l'API.",
        );
      }
    }

    const updated = await adminRepository.verifyStructure(id, adminId);

    // ← NOUVEAU : Si c'est une CNTS, on s'assure que son stock est initialisé
    if (existing.structureType === "CNTS") {
      await adminRepository.ensureStockInitialized(id);
    }

    emitToStructure(id, "structure:verified", {
      structureId: id,
      status: "VERIFIED",
      verifiedAt: updated.verifiedAt,
    });

    logger.logEvent("STRUCTURE_VERIFIED", {
      structureId: id,
      adminId,
      type: existing.structureType,
    });
    return updated;
  }

  // ── PATCH /admin/health-structures/:id/suspend ────────────────
  async suspendStructure(id, adminId, reason) {
    const existing = await adminRepository.findStructureById(id);
    if (!existing) throw new NotFoundError("Structure introuvable");

    const updated = await adminRepository.suspendStructure(id, adminId, reason);

    logger.logEvent("STRUCTURE_SUSPENDED", {
      structureId: id,
      adminId,
      reason,
    });
    return updated;
  }

  // ── GET /admin/audit-logs ─────────────────────────────────────
  async getAuditLogs(filters) {
    return adminRepository.findAuditLogs(filters);
  }
}

export default new AdminService();
