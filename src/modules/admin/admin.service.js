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
  async suspendUser(id, reason) {
    const user = await adminRepository.findUserById(id);
    if (!user) throw new NotFoundError("Utilisateur introuvable");
    if (!user.isActive)
      throw new BadRequestError("Cet utilisateur est déjà suspendu");

    const updated = await adminRepository.suspendUser(id, reason);

    logger.logEvent("ADMIN_USER_SUSPENDED", { targetId: id, reason });
    return updated;
  }

  // ── PATCH /admin/users/:id/reactivate ────────────────────────
  async reactivateUser(id) {
    const user = await adminRepository.findUserById(id);
    if (!user) throw new NotFoundError("Utilisateur introuvable");
    if (user.isActive)
      throw new BadRequestError("Cet utilisateur est déjà actif");

    const updated = await adminRepository.reactivateUser(id);

    logger.logEvent("ADMIN_USER_REACTIVATED", { targetId: id });
    return updated;
  }

  // ── GET /admin/health-structures ─────────────────────────────
  async getStructures(filters) {
    return adminRepository.findStructures(filters);
  }

  // ── PATCH /admin/health-structures/:id/verify ─────────────────
  async verifyStructure(id) {
    const updated = await adminRepository.verifyStructure(id);
    if (!updated) throw new NotFoundError("Structure introuvable");

    logger.logEvent("STRUCTURE_VERIFIED", { structureId: id });
    return updated;
  }

  // ── PATCH /admin/health-structures/:id/suspend ────────────────
  async suspendStructure(id, reason) {
    const updated = await adminRepository.suspendStructure(id, reason);
    if (!updated) throw new NotFoundError("Structure introuvable");

    logger.logEvent("STRUCTURE_SUSPENDED", { structureId: id, reason });
    return updated;
  }

  // ── GET /admin/audit-logs ─────────────────────────────────────
  async getAuditLogs(filters) {
    return adminRepository.findAuditLogs(filters);
  }
}

export default new AdminService();
