import adminRepository from "./admin.repository.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

class AdminService {
  // ── GET /admin/dashboard ─────────────────────────────────────
  async getDashboard() {
    return adminRepository.getDashboardKpis();
  }

  // ── GET /admin/stats/monthly ──────────────────────────────────
  async getMonthlyStats(year) {
    const currentYear = new Date().getFullYear();
    const targetYear = year || currentYear;

    // Sécurité : on ne peut pas demander l'année 2050
    if (targetYear < 2020 || targetYear > currentYear) {
      throw new BadRequestError(
        `Année invalide. L'année doit être comprise entre 2020 et ${currentYear}.`,
      );
    }

    return adminRepository.getMonthlyStats(targetYear);
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

    // ✅ On passe adminId
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

    // ✅ On passe adminId
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

    // ✅ On passe adminId
    const updated = await adminRepository.verifyStructure(id, adminId);

    logger.logEvent("STRUCTURE_VERIFIED", { structureId: id, adminId });
    return updated;
  }

  // ── PATCH /admin/health-structures/:id/suspend ────────────────
  async suspendStructure(id, adminId, reason) {
    const existing = await adminRepository.findStructureById(id);
    if (!existing) throw new NotFoundError("Structure introuvable");

    // ✅ On passe adminId
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
