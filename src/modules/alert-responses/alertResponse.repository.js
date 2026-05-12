import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

class AlertResponseRepository extends BaseRepository {
  constructor() {
    super(prisma.alertResponse);
  }

  // ─── Recherche & Vérification ─────────────────────────────────

  /** Vérifie si un donneur a déjà répondu à une alerte */
  findByAlertAndDonor(alertId, donorId) {
    return this.model.findUnique({
      where: { alertId_donorId: { alertId, donorId } },
    });
  }

  upsertDecline(alertId, donorId) {
    return this.model.upsert({
      where: { alertId_donorId: { alertId, donorId } },
      create: { alertId, donorId, status: "DECLINED" },
      update: { status: "DECLINED" },
    });
  }

  findActiveAlert(alertId) {
    return prisma.alert.findFirst({
      where: {
        id: alertId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });
  }
  // ⚠️ Idéalement dans JambaarsProfileRepository — placé ici pour respecter le contrat service
  /** Trouver le profil Jambaars d'un donneur (vérification d'éligibilité) */
  findDonorProfile(userId) {
    return prisma.jambaarsProfile.findUnique({
      where: { userId },
    });
  }

  // ─── Mutations AlertResponse ──────────────────────────────────

  /** Créer la réponse "J'y vais" */
  createResponse(data) {
    return this.model.create({ data });
  }

  /** Mettre à jour le statut / champs d'une réponse */
  updateStatus(id, data) {
    return this.model.update({
      where: { id },
      data,
    });
  }

  // ⚠️ Idéalement dans JambaarsProfileRepository
  /** Incrémenter le compteur de no-show sur le profil Jambaar */
  incrementNoShowCount(userId) {
    return prisma.jambaarsProfile.update({
      where: { userId },
      data: { noShowCount: { increment: 1 } },
    });
  }

  // ─── Mutations Alert ──────────────────────────────────────────
  // ⚠️ Idéalement dans AlertRepository — placé ici pour le contexte métier

  /** Incrémenter le compteur de confirmés sur l'alerte (confirm) */
  incrementConfirmedCount(alertId) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { quantityConfirmed: { increment: 1 } },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
      },
    });
  }

  /** Décrémenter le compteur de confirmés sur l'alerte (no-show) */
  decrementAlertConfirmedCount(alertId) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { quantityConfirmed: { decrement: 1 } },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });
  }

  /** Fermer l'alerte si quota atteint */
  closeAlert(alertId) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { status: "QUOTA_REACHED", closedAt: new Date() },
    });
  }

  /** Si un no-show fait repasser le quota en dessous du besoin, réouvrir l'alerte */
  async reopenAlertIfNecessary(alertId) {
    const alert = await prisma.alert.findUnique({
      // ← await manquant dans l'original
      where: { id: alertId },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });

    if (
      alert &&
      alert.status === "QUOTA_REACHED" &&
      alert.quantityConfirmed < alert.quantityNeeded
    ) {
      await prisma.alert.update({
        where: { id: alertId },
        data: { status: "ACTIVE", closedAt: null },
      });
      return true;
    }
    return false;
  }
}

export default new AlertResponseRepository();
