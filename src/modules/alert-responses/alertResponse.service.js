import alertResponseRepository from "./alertResponse.repository.js";
import { generateDonationQr } from "../../shared/utils/qrGenerator.utils.js";
import { isDonorEligible } from "../../shared/utils/points.utils.js";
import { emitToAlert } from "../../config/socket.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

class AlertResponseService {
  // ── POST /confirm ──────────────────────────────────────────────
  async confirm(alertId, donorId, body = {}) {
    // 1. Vérifier que l'alerte est toujours active
    const alert = await alertResponseRepository.findActiveAlert(alertId);
    if (!alert) throw new NotFoundError("Alerte introuvable ou expirée");

    const activeConfirmations =
      await alertResponseRepository.findActiveConfirmationsForDonor(donorId);
    if (activeConfirmations.length > 0) {
      throw new BadRequestError(
        "Vous avez déjà confirmé votre venue pour une autre alerte en cours. Vous ne pouvez pas vous engager pour celle-ci.",
      );
    }

    // 2. Vérification d'éligibilité médicale (via repository, plus de prisma direct)
    const donorProfile =
      await alertResponseRepository.findDonorProfile(donorId);
    if (
      donorProfile?.nextEligibilityAt &&
      !isDonorEligible(donorProfile.nextEligibilityAt)
    ) {
      throw new BadRequestError(
        "Vous n'êtes pas éligible pour donner actuellement (période d'attente en cours)",
      );
    }

    // 3. Empêcher les doublons
    const existingResponse = await alertResponseRepository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (existingResponse) {
      throw new BadRequestError("Vous avez déjà répondu à cette alerte");
    }

    // 4. Générer le QR Code
    const { code } = await generateDonationQr();

    // 5. Créer la réponse en base de données
    const newResponse = await alertResponseRepository.createResponse({
      alertId,
      donorId,
      status: "CONFIRMED",
      etaMinutes: body.etaMinutes || null,
      qrCode: code,
    });

    // 6. Incrémenter le quota de confirmés et vérifier la fermeture automatique
    const updatedAlert =
      await alertResponseRepository.incrementConfirmedCount(alertId);
    const isQuotaReached =
      updatedAlert.quantityConfirmed >= updatedAlert.quantityNeeded;

    if (isQuotaReached) {
      await alertResponseRepository.closeAlert(alertId);
    }

    // 7. Notifier le dashboard médecin en temps réel
    emitToAlert(alertId, "response:new", {
      responseId: newResponse.id, // ← utilise la vraie réponse créée
      status: "CONFIRMED",
      qrCode: code,
      isQuotaReached,
    });

    logger.logEvent("DONOR_CONFIRMED_ALERT", {
      alertId,
      donorId,
      isQuotaReached,
    });

    return {
      message:
        "Confirmation enregistrée. Présentez ce QR Code à l'accueil de l'hôpital.",
      qrCode: code,
      isQuotaReached,
    };
  }

  // ── POST /decline ────────────────────────────────────────────────
  async decline(alertId, donorId) {
    // 1. Vérifier que l'alerte est toujours active
    const alert = await alertResponseRepository.findActiveAlert(alertId);
    if (!alert) throw new NotFoundError("Alerte introuvable ou expirée");

    // 2. Vérifier s'il existe déjà une réponse
    const existing = await alertResponseRepository.findByAlertAndDonor(
      alertId,
      donorId,
    );

    if (existing?.status === "DECLINED") {
      return { message: "Vous avez déjà signalé votre indisponibilité." };
    }

    if (existing?.status === "CONFIRMED") {
      throw new BadRequestError(
        "Vous avez déjà confirmé votre venue. Contactez directement l'hôpital.",
      );
    }

    // 3. Upsert — crée si pas de réponse, met à jour sinon
    const response = await alertResponseRepository.upsertDecline(
      alertId,
      donorId,
    );

    // 4. Notifier le dashboard médecin
    emitToAlert(alertId, "response:declined", {
      responseId: response.id,
      donorId,
      status: "DECLINED",
    });

    logger.logEvent("DONOR_DECLINED_ALERT", { alertId, donorId });
    return { message: "Votre refus a été pris en compte." };
  }

  // ── PATCH /arrived ────────────────────────────────────────────────
  async markArrived(alertId, donorId, agentId) {
    // On retrouve la réponse du donneur spécifique sur cette alerte
    const response = await alertResponseRepository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (!response) {
      throw new NotFoundError(
        "Aucune réponse trouvée pour ce donneur sur cette alerte",
      );
    }
    if (response.status !== "CONFIRMED") {
      throw new BadRequestError(
        "Seuls les donneurs ayant confirmé peuvent marquer leur arrivée",
      );
    }

    // Calcul du temps de réponse réel (pour la gamification)
    const now = new Date();
    let etaMinutes = response.etaMinutes;
    if (!etaMinutes && response.respondedAt) {
      const ms = now - new Date(response.respondedAt); // ← now au lieu de response.arrivedAt (pas encore setté)
      etaMinutes = Math.floor(ms / 60000);
    }

    await alertResponseRepository.updateStatus(response.id, {
      status: "ARRIVED",
      arrivedAt: now,
      etaMinutes,
    });

    emitToAlert(response.alertId, "response:arrived", {
      responseId: response.id,
      donorId: response.donorId,
    });

    logger.logEvent("DONOR_ARRIVED", {
      responseId: response.id,
      etaMinutes,
    });
    return { message: "Arrivée confirmée. Scannez le QR Code du donneur." };
  }

  // ── PATCH /no-show ───────────────────────────────────────────────
  async markNoShow(alertId, donorId, agentId) {
    const response = await alertResponseRepository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (!response) {
      throw new NotFoundError(
        "Aucune réponse trouvée pour ce donneur sur cette alerte",
      );
    }
    if (response.status !== "CONFIRMED") {
      throw new BadRequestError(
        "Seuls les donneurs ayant confirmé peuvent être signalés comme absents",
      );
    }

    // 1. Mettre à jour le statut de la réponse
    await alertResponseRepository.updateStatus(response.id, {
      status: "NO_SHOW",
    });

    // 2. Incrémenter le compteur de no-show du donneur
    await alertResponseRepository.incrementNoShowCount(response.donorId);

    // 3. Décrémenter le compteur de confirmés sur l'alerte
    await alertResponseRepository.decrementAlertConfirmedCount(
      response.alertId,
    );

    // 4. Si le no-show fait repasser le quota en dessous du besoin → réouvrir
    const isReopened = await alertResponseRepository.reopenAlertIfNecessary(
      response.alertId, // ← alertResponseRepository (pas alertResponse)
    );

    logger.logEvent("DONOR_NO_SHOW", {
      alertId: response.alertId,
      donorId: response.donorId,
      isReopened,
    });

    return {
      message:
        "Signalement enregistré. Le système va ajuster le quota de l'alerte.",
    };
  }

  // ── GET /check-active-confirmation ────────────────────────────
  async checkActiveConfirmation(donorId) {
    const activeConfirmations =
      await alertResponseRepository.findActiveConfirmationsForDonor(donorId);

    return {
      hasActiveConfirmation: activeConfirmations.length > 0,
    };
  }

  // ── PATCH /cancel ────────────────────────────────────────────
  async cancelConfirmation(alertId, donorId) {
    const response = await alertResponseRepository.findByAlertAndDonor(
      alertId,
      donorId,
    );

    if (!response) {
      throw new NotFoundError("Aucune réponse trouvée pour cette alerte");
    }

    if (response.status !== "CONFIRMED") {
      throw new BadRequestError("Seule une confirmation peut être annulée");
    }

    // 1. Mettre à jour le statut de la réponse
    await alertResponseRepository.updateStatus(response.id, {
      status: "CANCELLED",
    });

    // 2. Décrémenter le quota de l'alerte
    await alertResponseRepository.decrementAlertConfirmedCount(alertId);

    // 3. Réouvrir l'alerte si le quota n'est plus atteint
    const isReopened =
      await alertResponseRepository.reopenAlertIfNecessary(alertId);

    // 4. Notifier l'hôpital en temps réel
    emitToAlert(alertId, "response:cancelled", {
      responseId: response.id,
      donorId,
      status: "CANCELLED",
      isReopened,
    });

    logger.logEvent("DONOR_CANCELLED_CONFIRMATION", {
      alertId,
      donorId,
      isReopened,
    });

    return { message: "Votre venue a été annulée. L'hôpital a été prévenu." };
  }
}

export default new AlertResponseService();
