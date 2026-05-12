import alertRepository from "./alert.repository.js";
import { findNearbyDonors } from "../../shared/utils/geolocation.utils.js";
import { sendMulticastPushNotification } from "../../config/expo.js";
import {
  emitToAlert,
  emitToStructure,
  emitToDonors,
} from "../../config/socket.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

// ─── Expiration auto selon le niveau d'urgence ────────────────
const AUTO_EXPIRY_MINUTES = {
  VITAL: 60, //  1 heure
  STANDARD: 240, //  4 heures
};

class AlertService {
  // ── POST /alerts — Créer une alerte ─────────────────────────
  async createAlert(data, user) {
    const {
      bloodType,
      quantityNeeded,
      urgencyLevel,
      serviceUnit,
      radiusKm,
      address,
      latitude,
      longitude,
      expiresAt,
    } = data;

    // La structure doit être vérifiée pour émettre des alertes
    const structure = user.employerStructure;
    if (!structure?.isVerified) {
      throw new ForbiddenError(
        "Votre structure doit être vérifiée avant de pouvoir émettre des alertes",
      );
    }

    // Coordonnées : priorité aux coords fournies, fallback sur la structure
    const alertLat = latitude ?? structure.latitude;
    const alertLng = longitude ?? structure.longitude;

    if (!alertLat || !alertLng) {
      throw new BadRequestError(
        "Coordonnées géographiques requises. Mettez à jour la localisation de votre structure.",
      );
    }

    // Expiration : fournie par l'agent ou calculée automatiquement
    const computedExpiry =
      expiresAt ??
      new Date(Date.now() + AUTO_EXPIRY_MINUTES[urgencyLevel] * 60 * 1000);

    // 1. Créer l'alerte en base
    const alert = await alertRepository.createAlert({
      bloodType,
      quantityNeeded,
      urgencyLevel,
      serviceUnit,
      radiusKm,
      address: address ?? structure.address,
      latitude: alertLat,
      longitude: alertLng,
      expiresAt: computedExpiry,
      healthStructureId: user.healthStructureId,
      createdByUserId: user.id,
    });

    // 2. Trouver les donneurs compatibles dans le rayon (Haversine SQL)
    const nearbyDonors = await findNearbyDonors(
      alertLat,
      alertLng,
      radiusKm,
      bloodType,
    );

    logger.logEvent("ALERT_CREATED", {
      alertId: alert.id,
      bloodType,
      urgencyLevel,
      nearbyDonors: nearbyDonors.length,
      structureId: user.healthStructureId,
    });

    // 3. Notifier en temps réel via Socket.io (donneurs connectés)
    emitToDonors("alert:new", {
      alertId: alert.id,
      bloodType: alert.bloodType,
      urgencyLevel: alert.urgencyLevel,
      serviceUnit: alert.serviceUnit,
      structureName: alert.healthStructure.name,
      address: alert.address,
      latitude: alert.latitude,
      longitude: alert.longitude,
      quantityNeeded: alert.quantityNeeded,
      expiresAt: alert.expiresAt,
    });

    // 4. Multicast push Expo aux donneurs hors-ligne avec token valide
    const tokens = nearbyDonors.map((d) => d.expoPushToken).filter(Boolean);

    if (tokens.length > 0) {
      // Fire-and-forget — on ne bloque pas la réponse HTTP
      sendMulticastPushNotification({
        tokens,
        title:
          urgencyLevel === "VITAL"
            ? "🚨 URGENCE VITALE — Don de sang requis !"
            : "🩸 Besoin de sang dans votre zone",
        body: `Groupe ${bloodType.replace("_", " ")} — ${alert.healthStructure.name}. Pouvez-vous venir ?`,
        data: {
          type: "ALERT_NEW",
          alertId: alert.id,
        },
      }).catch((err) =>
        logger.error({ err, alertId: alert.id }, "Erreur push multicast"),
      );
    }

    return { alert, notifiedDonors: nearbyDonors.length };
  }

  // ── GET /alerts — Alertes actives autour du donneur ─────────
  async getNearbyAlerts({ lat, lng }, user) {
    // Fallback : coordonnées du profil si non fournies en query
    const latitude = lat ?? user.latitude;
    const longitude = lng ?? user.longitude;

    if (!latitude || !longitude) {
      throw new BadRequestError(
        "Coordonnées requises. Activez la géolocalisation ou mettez à jour votre profil.",
      );
    }

    const rawAlerts = await alertRepository.findNearbyActive(
      latitude,
      longitude,
      15, // rayon par défaut donneur : 15 km
    );

    // Enrichir chaque alerte avec la distance formatée
    return rawAlerts.map((a) => ({
      ...a,
      distance_km: Math.round(a.distance_km * 10) / 10,
    }));
  }

  // ── GET /alerts/:id — Détail ─────────────────────────────────
  async getAlertById(alertId) {
    const alert = await alertRepository.findByIdWithDetails(alertId);
    if (!alert) throw new NotFoundError("Alerte");
    return alert;
  }

  // ── GET /alerts/my-structure ─────────────────────────────────
  async getMyStructureAlerts(user, filters) {
    if (!user.healthStructureId) {
      throw new ForbiddenError("Vous n'êtes rattaché à aucune structure");
    }

    const { data, total } = await alertRepository.findByStructure(
      user.healthStructureId,
      filters,
    );

    return {
      alerts: data,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  // ── GET /alerts/:id/responses — Dashboard médecin ────────────
  async getAlertResponses(alertId, user) {
    const alert = await alertRepository.findByIdWithDetails(alertId);
    if (!alert) throw new NotFoundError("Alerte");

    // Seul le personnel de la structure concernée ou un admin peut voir le dashboard
    if (
      user.role !== "ADMIN" &&
      alert.healthStructure.id !== user.healthStructureId
    ) {
      throw new ForbiddenError("Accès refusé à cette alerte");
    }

    const responses = await alertRepository.findResponses(alertId);

    const summary = {
      confirmed: responses.filter((r) => r.status === "CONFIRMED").length,
      arrived: responses.filter((r) => r.status === "ARRIVED").length,
      declined: responses.filter((r) => r.status === "DECLINED").length,
      noShow: responses.filter((r) => r.status === "NO_SHOW").length,
    };

    return { alert, responses, summary };
  }

  // ── PATCH /alerts/:id/close — Fermeture manuelle ─────────────
  async closeAlert(alertId, user) {
    const alert = await alertRepository.findByIdWithDetails(alertId);
    if (!alert) throw new NotFoundError("Alerte");

    // Seul le personnel de la structure ou un admin peut fermer
    if (
      user.role !== "ADMIN" &&
      alert.healthStructure.id !== user.healthStructureId
    ) {
      throw new ForbiddenError("Vous ne pouvez pas fermer cette alerte");
    }

    if (alert.status !== "ACTIVE") {
      throw new BadRequestError(
        `Cette alerte ne peut pas être fermée (statut actuel : ${alert.status})`,
      );
    }

    const closed = await alertRepository.closeAlert(alertId);

    // Notifier le dashboard en temps réel
    emitToAlert(alertId, "alert:closed", {
      alertId,
      status: "CANCELLED",
      closedAt: closed.closedAt,
    });

    // Notifier la structure
    emitToStructure(user.healthStructureId, "alert:closed", {
      alertId,
      status: "CANCELLED",
    });

    logger.logEvent("ALERT_CLOSED", {
      alertId,
      closedBy: user.id,
      structureId: user.healthStructureId,
    });

    return closed;
  }
}

export default new AlertService();
