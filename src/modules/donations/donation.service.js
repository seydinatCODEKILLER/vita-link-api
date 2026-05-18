import donationRepository from "./donation.repository.js";
import {
  calculateDonationPoints,
  calculateGrade,
  calculateNextEligibility,
} from "../../shared/utils/points.utils.js";
import {
  emitToUser,
  emitToAlert,
  emitToStructure,
} from "../../config/socket.js";
import { sendPushNotification } from "../../config/expo.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";
import jambaarService from "../jambaar-profile/jambaar.service.js";

class DonationService {
  // ── POST /donations/scan — Validation QR Code ────────────────
  async scanAndValidate({ qrCode, notes, testResultsJson }, agent) {
    // 1. Retrouver la réponse d'alerte via le QR Code
    const alertResponse =
      await donationRepository.findAlertResponseByQrCode(qrCode);

    if (!alertResponse) {
      throw new NotFoundError("QR Code invalide ou introuvable");
    }

    // 2. Vérifier que le don n'a pas déjà été validé (anti-doublon)
    if (alertResponse.donation) {
      throw new BadRequestError(
        "Ce QR Code a déjà été utilisé pour valider un don",
      );
    }

    // 3. Vérifier que le donneur avait bien confirmé
    if (
      alertResponse.status === "DECLINED" ||
      alertResponse.status === "NO_SHOW"
    ) {
      throw new BadRequestError(
        "Ce donneur n'a pas confirmé sa venue pour cette alerte",
      );
    }

    // 4. Vérifier que l'agent scanne bien pour SA structure
    if (
      agent.role !== "ADMIN" &&
      alertResponse.alert.healthStructureId !== agent.healthStructureId
    ) {
      throw new ForbiddenError(
        "Ce QR Code appartient à une autre structure de santé",
      );
    }

    const { donor, alert } = alertResponse;

    // 5. Calculer les points selon les règles Jambaar
    const pointsAwarded = calculateDonationPoints({
      urgencyLevel: alert.urgencyLevel,
      bloodType: alert.bloodType,
      etaMinutes: alertResponse.etaMinutes,
    });

    // 6. Calculer le nouveau grade (fallback à 0 si profil pas encore crée)
    const currentPoints = donor.jambaarsProfile?.totalPoints ?? 0;
    const newTotalPoints = currentPoints + pointsAwarded;
    const newGrade = calculateGrade(newTotalPoints);
    const gradeChanged =
      newGrade !== (donor.jambaarsProfile?.currentGrade ?? "ASPIRANT");

    // 7. Calculer la prochaine date d'éligibilité
    const nextEligibilityAt = calculateNextEligibility(donor.gender);

    // 8. Transaction atomique : don + points + stock
    const donation = await donationRepository.validateDonation({
      alertResponseId: alertResponse.id,
      donorId: donor.id,
      healthStructureId: alert.healthStructureId,
      validatedByUserId: agent.id,
      bloodType: alert.bloodType,
      pointsAwarded,
      newGrade,
      nextEligibilityAt,
      notes,
      testResultsJson,
    });

    logger.logEvent("DONATION_VALIDATED", {
      donationId: donation.id,
      donorId: donor.id,
      alertId: alert.id,
      pointsAwarded,
      newGrade,
      gradeChanged,
      agentId: agent.id,
    });

    // 9. Notifier le donneur en temps réel (Socket.io)
    emitToUser(donor.id, "donation:validated", {
      donationId: donation.id,
      pointsAwarded,
      newGrade,
      gradeChanged,
      totalPoints: newTotalPoints,
      nextEligibilityAt,
      updatedJambaarProfile: donation.donor.jambaarsProfile
    });

    // 10. Notifier la structure (dashboard stock)
    emitToStructure(alert.healthStructureId, "stock:updated", {
      bloodType: alert.bloodType,
      increment: 1,
    });

    // 11. Notifier le dashboard de l'alerte
    emitToAlert(alert.id, "response:arrived", {
      alertResponseId: alertResponse.id,
      donorId: donor.id,
      donationId: donation.id,
    });

    // 12. Push notification au donneur (fire-and-forget)
    this._sendDonorPushNotification(donor.id, {
      pointsAwarded,
      gradeChanged,
      newGrade,
    }).catch((err) =>
      logger.error({ err, donorId: donor.id }, "Erreur push donation validée"),
    );

    jambaarService
      .processBadgesAfterDonation(donor.id)
      .catch((err) =>
        logger.error({ err, donorId: donor.id }, "Erreur post-donation badges"),
      );

    return {
      message: "Don validé avec succès. Points Jambaar crédités.",
      donation,
      jambaar: {
        pointsAwarded,
        newTotalPoints,
        newGrade,
        gradeChanged,
        nextEligibilityAt,
      },
    };
  }

  // ── GET /donations/me — Historique donneur ───────────────────
  async getMyDonations(donorId, { page, limit }) {
    const { data, total } = await donationRepository.findMyDonations(donorId, {
      page,
      limit,
    });

    return {
      donations: data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── GET /donations/:id — Détail ──────────────────────────────
  async getDonationById(donationId, user) {
    const donation = await donationRepository.findById(donationId);
    if (!donation) throw new NotFoundError("Don");

    // Un donneur ne peut voir que ses propres dons
    if (user.role === "DONOR" && donation.donor.id !== user.id) {
      throw new ForbiddenError("Accès refusé");
    }

    return donation;
  }

  // ── GET /donations/structure — Historique structure ──────────
  async getStructureDonations(user, { page, limit }) {
    if (!user.healthStructureId) {
      throw new ForbiddenError("Vous n'êtes rattaché à aucune structure");
    }

    const { data, total } = await donationRepository.findStructureDonations(
      user.healthStructureId,
      { page, limit },
    );

    return {
      donations: data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Helper privé : push notification donneur ─────────────────
  async _sendDonorPushNotification(
    donorId,
    { pointsAwarded, gradeChanged, newGrade },
  ) {
    const user = await donationRepository.findUserPushToken(donorId);

    if (!user?.expoPushToken) return;

    const title = gradeChanged
      ? `🏅 Nouveau grade : ${newGrade} !`
      : "🩸 Don validé — Merci Jambaar !";

    const body = gradeChanged
      ? `Félicitations ! Vous êtes maintenant ${newGrade}. +${pointsAwarded} pts`
      : `+${pointsAwarded} points Jambaar crédités sur votre profil.`;

    await sendPushNotification({
      token: user.expoPushToken,
      title,
      body,
      data: { type: "DONATION_VALIDATED", pointsAwarded, newGrade },
    });
  }
}

export default new DonationService();
