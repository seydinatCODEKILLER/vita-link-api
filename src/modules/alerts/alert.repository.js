import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const ALERT_SUMMARY_SELECT = {
  id: true,
  bloodType: true,
  quantityNeeded: true,
  quantityConfirmed: true,
  urgencyLevel: true,
  status: true,
  serviceUnit: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusKm: true,
  expiresAt: true,
  createdAt: true,
  healthStructure: {
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
    },
  },
};

export const ALERT_DETAIL_SELECT = {
  ...ALERT_SUMMARY_SELECT,
  closedAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  _count: {
    select: { alertResponses: true },
  },
};

export const RESPONSE_SELECT = {
  id: true,
  status: true,
  etaMinutes: true,
  respondedAt: true,
  arrivedAt: true,
  donor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bloodType: true,
      avatarUrl: true,
      phone: true,
    },
  },
};

// ─── Repository ───────────────────────────────────────────────

class AlertRepository extends BaseRepository {
  constructor() {
    super(prisma.alert);
  }

  // ─── Création ──────────────────────────────────────────────

  createAlert(data) {
    return this.model.create({
      data,
      select: ALERT_DETAIL_SELECT,
    });
  }

  // ─── Lecture ───────────────────────────────────────────────

  findByIdWithDetails(id) {
    return this.model.findUnique({
      where: { id },
      select: ALERT_DETAIL_SELECT,
    });
  }

  /**
   * Alertes actives autour d'un point géographique (Haversine SQL).
   * Filtre sur : status=ACTIVE + non expirée + dans le rayon de chaque alerte.
   * Retourne aussi la distance calculée pour l'affichage côté client.
   */
  findNearbyActive(latitude, longitude, radiusKm, userId) {
    return this.prisma.$queryRaw`
    SELECT
      a.id,
      a."bloodType",
      a."quantityNeeded",
      a."quantityConfirmed",
      a."urgencyLevel",
      a.status,
      a."serviceUnit",
      a.address,
      a.latitude,
      a.longitude,
      a."radiusKm",
      a."expiresAt",
      a."createdAt",
      hs.id   AS "structureId",
      hs.name AS "structureName",
      hs.address AS "structureAddress",
      hs.latitude AS "structureLatitude",
      hs.longitude AS "structureLongitude",
      (
        6371 * acos(
          LEAST(1.0, cos(radians(${latitude})) * cos(radians(a.latitude)) *
          cos(radians(a.longitude) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(a.latitude)))
        )
      ) AS distance_km
    FROM alerts a
    JOIN health_structures hs ON hs.id = a."healthStructureId"
    WHERE
      a.status = 'ACTIVE'
      AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
      AND a.latitude  IS NOT NULL
      AND a.longitude IS NOT NULL
      AND (
        6371 * acos(
          LEAST(1.0, cos(radians(${latitude})) * cos(radians(a.latitude)) *
          cos(radians(a.longitude) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(a.latitude)))
        )
      ) <= LEAST(a."radiusKm", ${radiusKm})
      AND NOT EXISTS (
        SELECT 1 FROM alert_responses ar
        WHERE ar."alertId" = a.id
        -- ✅ SOLUTION : On caste le userId en UUID avec ::uuid
        AND ar."donorId" = ${userId}::uuid
        AND ar.status IN ('CONFIRMED', 'ARRIVED')
      )
    ORDER BY
      CASE a."urgencyLevel" WHEN 'VITAL' THEN 0 ELSE 1 END ASC,
      distance_km ASC
  `;
  }

  findByStructure(structureId, { page, limit, status }) {
    const where = {
      healthStructureId: structureId,
      ...(status && { status }),
    };

    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: {
        ...ALERT_SUMMARY_SELECT,
        _count: { select: { alertResponses: true } },
      },
    });
  }

  // ─── Réponses (dashboard médecin) ─────────────────────────

  findResponses(alertId) {
    return this.prisma.alertResponse.findMany({
      where: { alertId },
      select: RESPONSE_SELECT,
      orderBy: [
        // Confirmés et en route en premier, refus en dernier
        { status: "asc" },
        { respondedAt: "asc" },
      ],
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  /**
   * Incrémente quantityConfirmed et vérifie si le quota est atteint.
   * Retourne l'alerte mise à jour.
   */
  async incrementConfirmed(alertId) {
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.update({
        where: { id: alertId },
        data: { quantityConfirmed: { increment: 1 } },
        select: {
          id: true,
          quantityNeeded: true,
          quantityConfirmed: true,
          status: true,
          healthStructureId: true,
        },
      });

      // Auto-fermeture si quota atteint
      if (
        alert.quantityConfirmed >= alert.quantityNeeded &&
        alert.status === "ACTIVE"
      ) {
        return tx.alert.update({
          where: { id: alertId },
          data: { status: "QUOTA_REACHED", closedAt: new Date() },
          select: {
            id: true,
            quantityNeeded: true,
            quantityConfirmed: true,
            status: true,
            healthStructureId: true,
          },
        });
      }

      return alert;
    });
  }

  closeAlert(alertId) {
    return this.model.update({
      where: { id: alertId },
      data: { status: "CANCELLED", closedAt: new Date() },
      select: ALERT_DETAIL_SELECT,
    });
  }

  expireStaleAlerts() {
    return this.model.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }
}

export default new AlertRepository();
