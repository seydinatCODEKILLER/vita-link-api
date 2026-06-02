import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const DONATION_SUMMARY_SELECT = {
  id: true,
  isDone: true,
  pointsAwarded: true,
  donatedAt: true,
  validatedAt: true,
  notes: true,
  healthStructure: {
    // 🆕 AJOUT CRITIQUE
    select: { id: true, name: true },
  },
  alertResponse: {
    select: {
      qrCode: true,
      etaMinutes: true,
      alert: {
        select: {
          id: true,
          bloodType: true,
          urgencyLevel: true,
          serviceUnit: true,
          healthStructure: {
            select: { id: true, name: true, address: true },
          },
        },
      },
    },
  },
};

export const DONATION_DETAIL_SELECT = {
  ...DONATION_SUMMARY_SELECT,
  testResultsJson: true,
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
  validatedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  healthStructure: {
    select: { id: true, name: true },
  },
};

// ─── Repository ───────────────────────────────────────────────

class DonationRepository extends BaseRepository {
  constructor() {
    super(prisma.donation);
  }

  // ─── Lookup QR Code ────────────────────────────────────────

  /**
   * Retrouve la réponse d'alerte à partir du QR Code scanné.
   * Point d'entrée du flux de validation.
   */
  findAlertResponseByQrCode(qrCode) {
    return this.prisma.alertResponse.findFirst({
      where: { qrCode },
      select: {
        id: true,
        alertId: true,
        donorId: true,
        status: true,
        etaMinutes: true,
        respondedAt: true,
        donation: { select: { id: true } },
        alert: {
          select: {
            id: true,
            bloodType: true,
            urgencyLevel: true,
            healthStructureId: true,
          },
        },
        donor: {
          select: {
            id: true,
            gender: true,
            jambaarsProfile: {
              select: {
                id: true,
                totalPoints: true,
                currentGrade: true,
                donationCount: true,
              },
            },
          },
        },
      },
    });
  }

  findUserPushToken(userId) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, firstName: true },
    });
  }

  // ─── Création don + mutations atomiques ───────────────────

  /**
   * Transaction complète de validation d'un don :
   * 1. Crée la Donation
   * 2. Passe alertResponse → ARRIVED
   * 3. Crédite les points sur JambaarsProfile
   * 4. Calcule et applique le nouveau grade
   * 5. Met à jour nextEligibilityAt
   * 6. Upsert BloodStock
   */
  async validateDonation({
    alertResponseId,
    donorId,
    healthStructureId,
    stockStructureId, // ← NOUVEAU PARAMÈTRE
    validatedByUserId,
    bloodType,
    pointsAwarded,
    newGrade,
    nextEligibilityAt,
    notes,
    testResultsJson,
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Créer le don (lié à l'hôpital/structure physique)
      const donation = await tx.donation.create({
        data: {
          donorId,
          alertResponseId,
          healthStructureId, // L'hôpital où le don se fait
          validatedByUserId,
          isDone: true,
          pointsAwarded,
          notes,
          testResultsJson,
          donatedAt: new Date(),
          validatedAt: new Date(),
        },
        select: DONATION_DETAIL_SELECT,
      });

      // 2. Passer la réponse d'alerte à ARRIVED
      await tx.alertResponse.update({
        where: { id: alertResponseId },
        data: { status: "ARRIVED", arrivedAt: new Date() },
      });

      // 3. Upsert JambaarsProfile
      await tx.jambaarsProfile.upsert({
        where: { userId: donorId },
        update: {
          totalPoints: { increment: pointsAwarded },
          donationCount: { increment: 1 },
          currentGrade: newGrade,
          lastDonationAt: new Date(),
          nextEligibilityAt,
          livesSavedEstimate: { increment: 3 },
        },
        create: {
          userId: donorId,
          totalPoints: pointsAwarded,
          donationCount: 1,
          currentGrade: newGrade,
          lastDonationAt: new Date(),
          nextEligibilityAt,
          livesSavedEstimate: 3,
        },
      });

      // 4. Upsert BloodStock ← MODIFIÉ : Utilise stockStructureId (la CNTS)
      await tx.bloodStock.upsert({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: stockStructureId, // ← CNTS ici
            bloodType,
          },
        },
        create: {
          healthStructureId: stockStructureId, // ← CNTS ici
          bloodType,
          quantity: 1,
          level: "ADEQUATE",
        },
        update: {
          quantity: { increment: 1 },
        },
      });

      return donation;
    });
  }

  // ─── Lecture ───────────────────────────────────────────────

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: DONATION_DETAIL_SELECT,
    });
  }

  findMyDonations(donorId, { page, limit }) {
    return this.findManyWithCount(
      { donorId, isDone: true },
      {
        page,
        limit,
        sort: { donatedAt: "desc" },
        select: DONATION_SUMMARY_SELECT,
      },
    );
  }

  findStructureDonations(healthStructureId, { page, limit }) {
    return this.findManyWithCount(
      { healthStructureId, isDone: true },
      {
        page,
        limit,
        sort: { donatedAt: "desc" },
        select: DONATION_DETAIL_SELECT,
      },
    );
  }
}

export default new DonationRepository();
