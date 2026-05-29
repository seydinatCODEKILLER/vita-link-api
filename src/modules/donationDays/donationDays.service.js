import donationDayRepository from "./donationDays.repository.js";
import MediaUploader from "../../shared/utils/uploader.utils.js";
import logger from "../../config/logger.js";
import { isDonorEligible } from "../../shared/utils/points.utils.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from "../../shared/errors/AppError.js";

class DonationDayService {
  // ── STRUCTURES DE SANTÉ ────────────────────────────────────

  async getPublishedDays(user, filters) {
    const donorBloodType = user.bloodType ?? null;
    return donationDayRepository.findNearbyPublished(donorBloodType, filters);
  }

  async getMyStructureDays(user, structureId, filters) {
    if (!structureId)
      throw new ForbiddenError("Vous n'êtes rattaché à aucune structure");
    return donationDayRepository.findMyStructureDays(structureId, filters);
  }

  async getDayDetail(user, dayId, userRole) {
    const day = await donationDayRepository.findById(dayId);
    if (!day) throw new NotFoundError("Journée de don");

    if (userRole === "DONOR" && day.status !== "PUBLISHED") {
      throw new NotFoundError("Journée de don");
    }

    if (
      userRole === "HEALTH_STRUCTURE" &&
      day.healthStructure.id !== user.healthStructureId
    ) {
      throw new ForbiddenError("Vous n'êtes pas autorisé à voir cette journée");
    }

    const activeRegistrationsCount = day.registrations.filter(
      (r) => r.status !== "CANCELLED",
    ).length;
    const remainingSpots = Math.max(
      0,
      day.targetDonors - activeRegistrationsCount,
    );

    return { ...day, remainingSpots };
  }

  async createDay(user, structureId, data, file) {
    if (!structureId)
      throw new ForbiddenError("Vous n'êtes rattaché à aucune structure");

    const existingDay = await donationDayRepository.findStructureDayByDate(
      structureId,
      data.scheduledDate,
    );
    if (existingDay) {
      throw new ConflictError(
        "Vous avez déjà programmé un événement de don pour cette date",
      );
    }

    let photoUrl = null;
    if (file) {
      const uploader = new MediaUploader();
      const uploadResult = await uploader.upload(
        file,
        "vita-link/events",
        `event_${Date.now()}`,
      );
      photoUrl = uploadResult.url;
    }

    const day = await donationDayRepository.createDay({
      ...data,
      photoUrl,
      healthStructureId: structureId,
      createdByUserId: user.id,
      status: "PUBLISHED",
      publishedAt: new Date(),
    });

    logger.logEvent("DONATION_DAY_CREATED", {
      dayId: day.id,
      structureId,
      createdBy: user.id,
    });
    return day;
  }

  async updateDay(user, dayId, data, file) {
    const day = await donationDayRepository.findById(dayId);
    if (!day) throw new NotFoundError("Journée de don");

    if (day.healthStructure.id !== user.healthStructureId)
      throw new ForbiddenError("Non autorisé");
    if (day.status === "COMPLETED" || day.status === "CANCELLED") {
      throw new BadRequestError(
        "Impossible de modifier une journée terminée ou annulée",
      );
    }
    if (new Date(day.scheduledDate) < new Date()) {
      throw new BadRequestError(
        "Impossible de modifier une journée dont la date est déjà passée",
      );
    }

    if (data.scheduledDate) {
      const existingDay = await donationDayRepository.findStructureDayByDate(
        user.healthStructureId,
        data.scheduledDate,
      );
      if (existingDay && existingDay.id !== dayId) {
        throw new ConflictError(
          "Vous avez déjà programmé un autre événement de don pour cette date",
        );
      }
    }

    let photoUrl = day.photoUrl;
    if (file) {
      const uploader = new MediaUploader();
      if (day.photoUrl) await uploader.deleteByUrl(day.photoUrl);
      const uploadResult = await uploader.upload(
        file,
        "vita-link/events",
        `event_${dayId}_${Date.now()}`,
      );
      photoUrl = uploadResult.url;
    }

    const updated = await donationDayRepository.updateDay(dayId, {
      ...data,
      photoUrl,
    });
    logger.logEvent("DONATION_DAY_UPDATED", { dayId, updatedBy: user.id });
    return updated;
  }

  async cancelDay(user, dayId, cancelReason) {
    const day = await donationDayRepository.findById(dayId);
    if (!day) throw new NotFoundError("Journée de don");

    if (day.healthStructure.id !== user.healthStructureId)
      throw new ForbiddenError("Non autorisé");
    if (day.status === "CANCELLED") throw new BadRequestError("Déjà annulée");
    if (day.status === "COMPLETED")
      throw new BadRequestError("Impossible d'annuler une journée terminée");

    const cancelled = await donationDayRepository.updateDay(dayId, {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason,
    });

    if (day.registrations && day.registrations.length > 0) {
      const activeRegistrations = day.registrations.filter(
        (r) => r.status === "REGISTERED",
      );
      activeRegistrations.forEach((registration) => {
        emitToUser(registration.donor.id, "donation-day:cancelled", {
          dayId: day.id,
          title: day.title,
          scheduledDate: day.scheduledDate,
          cancelReason,
          message: `La journée de don "${day.title}" prévue le ${new Date(day.scheduledDate).toLocaleDateString("fr-FR")} a été annulée. Raison : ${cancelReason}`,
        });
      });
    }

    logger.logEvent("DONATION_DAY_CANCELLED", {
      dayId,
      structureId: user.healthStructureId,
      cancelledBy: user.id,
      notifiedDonors: day.registrations?.length || 0,
    });

    return cancelled;
  }

  // ── GESTION DES INSCRIPTIONS (STRUCTURES) ──────────────────

  async getRegistrations(user, dayId) {
    const day = await donationDayRepository.findById(dayId);
    if (!day) throw new NotFoundError("Journée de don");

    if (day.healthStructure.id !== user.healthStructureId)
      throw new ForbiddenError("Non autorisé");

    const registrations = day.registrations ?? [];
    const summary = {
      registered: registrations.filter((r) => r.status === "REGISTERED").length,
      attended: registrations.filter((r) => r.status === "ATTENDED").length,
      noShow: registrations.filter((r) => r.status === "NO_SHOW").length,
      cancelled: registrations.filter((r) => r.status === "CANCELLED").length,
    };

    return { registrations, summary };
  }

  async markAttendance(user, registrationId, status) {
    const registration =
      await donationDayRepository.findRegistration(registrationId);
    if (!registration) throw new NotFoundError("Inscription");

    const day = await donationDayRepository.findById(
      registration.donationDayId,
    );
    if (!day) throw new NotFoundError("Journée de don");

    if (day.healthStructure.id !== user.healthStructureId)
      throw new ForbiddenError("Non autorisé");

    if (
      registration.status === "ATTENDED" ||
      registration.status === "NO_SHOW"
    ) {
      throw new BadRequestError(
        "Ce donneur a déjà été marqué présent ou absent",
      );
    }

    return donationDayRepository.updateRegistration(registrationId, {
      status,
      attendedAt: status === "ATTENDED" ? new Date() : null,
    });
  }

  // ── DONNEURS ───────────────────────────────────────────────

  async getMyRegistrations(donorId, filters) {
    return donationDayRepository.findMyUpcomingRegistrations(donorId, filters);
  }

  async registerDonor(donorId, dayId) {
    const day = await donationDayRepository.findById(dayId);
    if (!day) throw new NotFoundError("Journée de don");

    if (day.status !== "PUBLISHED")
      throw new BadRequestError(
        "Cette journée n'est plus ouverte aux inscriptions",
      );
    if (new Date(day.scheduledDate) < new Date())
      throw new BadRequestError(
        "Impossible de s'inscrire à une journée déjà passée",
      );

    // ✅ AJOUT : Vérification éligibilité médicale du donneur
    // On récupère nextEligibilityAt depuis le profil Jambaar
    const donorProfile =
      await donationDayRepository.findDonorEligibility(donorId);

    if (!donorProfile) throw new NotFoundError("Profil donneur introuvable");

    const nextEligibilityAt =
      donorProfile.jambaarsProfile?.nextEligibilityAt ?? null;

    if (nextEligibilityAt && !isDonorEligible(nextEligibilityAt)) {
      const now = new Date();
      const eligibleDate = new Date(nextEligibilityAt);
      const daysRemaining = Math.ceil(
        (eligibleDate - now) / (1000 * 60 * 60 * 24),
      );

      throw new BadRequestError(
        `Vous n'êtes pas encore éligible pour donner votre sang. ` +
          `Vous pourrez vous inscrire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} ` +
          `(à partir du ${eligibleDate.toLocaleDateString("fr-FR")}).`,
      );
    }

    const activeRegistration =
      await donationDayRepository.findActiveRegistration(donorId);
    if (activeRegistration) {
      const eventDate = new Date(
        activeRegistration.donationDay.scheduledDate,
      ).toLocaleDateString("fr-FR");
      throw new ConflictError(
        `Vous êtes déjà inscrit à la journée "${activeRegistration.donationDay.title}" ` +
          `prévue le ${eventDate}. Annulez d'abord cette inscription avant de vous réinscrire.`,
      );
    }

    // Vérifier s'il reste de la place
    const activeRegistrationsCount = day.registrations.filter(
      (r) => r.status !== "CANCELLED",
    ).length;
    if (activeRegistrationsCount >= day.targetDonors) {
      throw new BadRequestError(
        "Il n'y a plus de places disponibles pour cette journée",
      );
    }

    const existing = await donationDayRepository.findExistingRegistration(
      dayId,
      donorId,
    );
    if (existing) {
      if (existing.status === "CANCELLED")
        throw new ConflictError(
          "Vous avez déjà annulé votre inscription pour cette journée",
        );
      throw new ConflictError("Vous êtes déjà inscrit à cette journée");
    }

    const registration = await donationDayRepository.createRegistration({
      donationDayId: dayId,
      donorId,
      status: "REGISTERED",
    });

    logger.logEvent("DONOR_REGISTERED_DAY", { donorId, dayId });
    return registration;
  }

  async cancelDonorRegistration(donorId, dayId) {
    const existing = await donationDayRepository.findExistingRegistration(
      dayId,
      donorId,
    );
    if (!existing) throw new NotFoundError("Inscription introuvable");

    if (existing.status !== "REGISTERED") {
      throw new BadRequestError(
        "Impossible d'annuler (déjà présent, absent, ou annulé)",
      );
    }

    const day = await donationDayRepository.findById(dayId);

    const now = new Date();
    const eventDate = new Date(day.scheduledDate);
    const hoursDiff = (eventDate - now) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      throw new BadRequestError(
        "Impossible d'annuler moins de 24 heures avant l'événement",
      );
    }

    const cancelled = await donationDayRepository.updateRegistration(
      existing.id,
      {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    );

    logger.logEvent("DONOR_CANCELLED_DAY", { donorId, dayId });
    return {
      message: "Inscription annulée avec succès",
      registration: cancelled,
    };
  }

  // ── ADMIN ──────────────────────────────────────────────────

  async getAllDays(filters) {
    return donationDayRepository.findAllForAdmin(filters);
  }

  async suspendDay(dayId) {
    const day = await donationDayRepository.findById(dayId);
    if (!day) throw new NotFoundError("Journée de don");

    if (day.status === "CANCELLED")
      throw new BadRequestError("Cette journée est déjà annulée");
    if (day.status === "COMPLETED")
      throw new BadRequestError(
        "Impossible de suspendre une journée déjà terminée",
      );

    const suspended = await donationDayRepository.updateDay(dayId, {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason:
        "Suspendue par l'administration Vita-Link (fraude ou non-conformité)",
    });

    logger.logEvent("DONATION_DAY_SUSPENDED_BY_ADMIN", { dayId });
    return suspended;
  }
}

export default new DonationDayService();
