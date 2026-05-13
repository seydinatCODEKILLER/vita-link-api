import partnerRepository from "./partner.repository.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";
import MediaUploader from "../../shared/utils/uploader.utils.js";

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
  async createPartner(data, file, adminId) {
    const existing = await partnerRepository.findByName(data.name);
    if (existing) {
      throw new ConflictError(
        `Un partenaire avec le nom "${data.name}" existe déjà`,
      );
    }

    const uploader = new MediaUploader();
    let logoUrl = null;

    try {
      // 1. Upload le logo si fourni
      if (file) {
        const result = await uploader.upload(
          file,
          "vita-link/partners",
          "partner_logo",
        );
        logoUrl = result.url;
      }

      // 2. Créer le partenaire en base
      const partner = await partnerRepository.createPartner({
        ...data,
        logoUrl, // Peut être null
        managedByUserId: adminId,
      });

      logger.logEvent("PARTNER_CREATED", {
        partnerId: partner.id,
        name: partner.name,
      });

      return partner;
    } catch (error) {
      if (logoUrl) {
        logger.warn("Rollback de l'image Cloudinary suite à une erreur DB");
        const uploadedInfo = uploader.uploadResults.get("partner_logo");
        if (uploadedInfo?.public_id) {
          await uploader.rollback(uploadedInfo.public_id);
        }
      }
      throw error;
    }
  }

  async updatePartner(id, data, file) {
    const existing = await partnerRepository.findById(id);
    if (!existing) throw new NotFoundError("Partenaire");

    if (data.name && data.name !== existing.name) {
      const nameConflict = await partnerRepository.findByName(data.name);
      if (nameConflict) {
        throw new ConflictError(
          `Un partenaire avec le nom "${data.name}" existe déjà`,
        );
      }
    }

    const uploader = new MediaUploader();
    let newLogoUrl = existing.logoUrl;
    let newUploadPublicId = null;

    try {
      if (file) {
        const result = await uploader.upload(
          file,
          "vita-link/partners",
          "partner_update_logo",
        );
        newLogoUrl = result.url;
        newUploadPublicId = result.public_id;
      }

      // 2. Mettre à jour la base de données
      const partner = await partnerRepository.updatePartner(id, {
        ...data,
        logoUrl: newLogoUrl,
      });

      if (file && existing.logoUrl) {
        await uploader.deleteByUrl(existing.logoUrl);
      }

      logger.logEvent("PARTNER_UPDATED", {
        partnerId: partner.id,
      });

      return partner;
    } catch (error) {
      if (newUploadPublicId) {
        logger.warn(
          "Rollback du nouveau logo Cloudinary suite à une erreur DB",
        );
        await uploader.rollback(newUploadPublicId);
      }
      throw error;
    }
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
