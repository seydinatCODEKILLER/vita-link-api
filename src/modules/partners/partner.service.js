import partnerRepository from "./partner.repository.js";
import logger from "../../config/logger.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../shared/errors/AppError.js";

class PartnerService {
  
  // ── GET /partners (Public/Donneur) ─────────────────────────
  async listActivePartners() {
    return partnerRepository.findAllActive();
  }

  // ── GET /partners (Admin) ──────────────────────────────────
  async listAllPartners() {
    return partnerRepository.findAllForAdmin();
  }

  // ── GET /partners/:id ──────────────────────────────────────
  async getPartnerById(id, userRole) {
    const partner = await partnerRepository.findById(id);
    if (!partner) throw new NotFoundError("Partenaire");

    // Si le partenaire est désactivé, seul l'Admin peut le voir
    if (!partner.isActive && userRole !== "ADMIN") {
      throw new NotFoundError("Partenaire");
    }

    return partner;
  }

  // ── POST /partners ─────────────────────────────────────────
  async createPartner(data, adminId) {
    const partner = await partnerRepository.createPartner({
      ...data,
      managedByUserId: adminId,
    });

    logger.logEvent("PARTNER_CREATED", {
      partnerId: partner.id,
      name: partner.name,
    });

    return partner;
  }

  // ── PATCH /partners/:id ────────────────────────────────────
  async updatePartner(id, data) {
    const existing = await partnerRepository.findById(id);
    if (!existing) throw new NotFoundError("Partenaire");

    const partner = await partnerRepository.updatePartner(id, data);

    logger.logEvent("PARTNER_UPDATED", {
      partnerId: partner.id,
    });

    return partner;
  }

  // ── DELETE /partners/:id ───────────────────────────────────
  async deactivatePartner(id) {
    const existing = await partnerRepository.findById(id);
    if (!existing) throw new NotFoundError("Partenaire");

    if (!existing.isActive) {
      throw new ConflictError("Ce partenaire est déjà désactivé");
    }

    const partner = await partnerRepository.softDelete(id);

    logger.logEvent("PARTNER_DEACTIVATED", {
      partnerId: partner.id,
      name: partner.name,
    });

    return partner;
  }
}

export default new PartnerService();