import { prisma } from "../../config/database.js";

// Admin n'hérite PAS de BaseRepository
// Il fait ses propres requêtes cross-tables pour les KPIs et agrégations

class AdminRepository {
  // ─── Dashboard KPIs ────────────────────────────────────────

  async getDashboardKpis() {
    const [
      totalDonors,
      totalStructures,
      totalDonations,
      totalAlerts,
      avgResponseTime,
      criticalStocks,
      livesSaved,
      pendingStructures,
    ] = await Promise.all([
      // Nombre total de donneurs actifs
      prisma.user.count({
        where: { role: "DONOR", isActive: true },
      }),

      // Nombre total de structures vérifiées
      prisma.healthStructure.count({
        where: { status: "VERIFIED" },
      }),

      // Nombre total de dons validés (= vies sauvées approximatives)
      prisma.donation.count({
        where: { isDone: true },
      }),

      // Nombre total d'alertes clôturées (quota atteint)
      prisma.alert.count({
        where: { status: "QUOTA_REACHED" },
      }),

      // Temps de réponse moyen national (en minutes)
      prisma.$queryRaw`
        SELECT ROUND(
          AVG(
            EXTRACT(EPOCH FROM (ar."arrivedAt" - a."createdAt")) / 60
          )::numeric, 1
        ) as avg_minutes
        FROM alert_responses ar
        JOIN alerts a ON a.id = ar."alertId"
        WHERE ar."arrivedAt" IS NOT NULL
      `,

      // Structures avec stocks critiques
      prisma.bloodStock.groupBy({
        by: ["healthStructureId"],
        where: { level: "CRITICAL" },
        _count: { healthStructureId: true },
      }),

      // Estimation vies sauvées (somme des livesSavedEstimate)
      prisma.jambaarsProfile.aggregate({
        _sum: { livesSavedEstimate: true },
      }),

      // Structures en attente de validation
      prisma.healthStructure.count({
        where: { status: "PENDING_REVIEW" },
      }),
    ]);

    return {
      totalDonors,
      totalStructures,
      totalDonations,
      totalAlerts,
      avgResponseTimeMinutes: avgResponseTime[0]?.avg_minutes
        ? Number(avgResponseTime[0].avg_minutes)
        : null,
      criticalStocksCount: criticalStocks.length,
      livesSavedEstimate: livesSaved._sum.livesSavedEstimate ?? 0,
      pendingStructures,
    };
  }

  // ─── Users ─────────────────────────────────────────────────

  findUsers({ role, bloodType, city, isActive, page, limit }) {
    const where = {
      ...(role && { role }),
      ...(bloodType && { bloodType }),
      ...(isActive !== undefined && { isActive }),
      ...(city && {
        jambaarsProfile: { city: { contains: city, mode: "insensitive" } },
      }),
    };

    return Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          bloodType: true,
          isActive: true,
          isAvailable: true,
          createdAt: true,
          jambaarsProfile: {
            select: {
              totalPoints: true,
              currentGrade: true,
              donationCount: true,
              noShowCount: true,
              city: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  }

  findUserById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        bloodType: true,
        gender: true,
        isActive: true,
        isAvailable: true,
        isStructureAdmin: true,
        healthStructureId: true,
        createdAt: true,
        jambaarsProfile: {
          select: {
            totalPoints: true,
            currentGrade: true,
            donationCount: true,
            livesSavedEstimate: true,
            noShowCount: true,
            lastDonationAt: true,
            nextEligibilityAt: true,
            city: true,
            district: true,
          },
        },
        employerStructure: {
          select: { id: true, name: true, status: true },
        },
        _count: {
          select: { donations: true, alertResponses: true },
        },
      },
    });
  }

  suspendUser(targetId, adminId, reason) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetId },
        data: {
          isActive: false,
          refreshToken: null,
          refreshTokenExpiresAt: null,
        },
        select: { id: true, firstName: true, lastName: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId, // ✅ C'est maintenant l'ID de l'Admin
          action: "USER_SUSPENDED",
          entityType: "USER",
          entityId: targetId,
          details: reason ? JSON.stringify({ reason }) : null,
        },
      });

      return user;
    });
  }

  reactivateUser(targetId, adminId) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetId },
        data: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId, // ✅ C'est maintenant l'ID de l'Admin
          action: "USER_REACTIVATED",
          entityType: "USER",
          entityId: targetId,
        },
      });

      return user;
    });
  }

  // ─── Health Structures ─────────────────────────────────────

  findStructures({ status, page, limit }) {
    const where = { ...(status && { status }) };

    return Promise.all([
      prisma.healthStructure.findMany({
        where,
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          address: true,
          phone: true,
          email: true,
          isVerified: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
          _count: {
            select: { staffMembers: true, alerts: true, donations: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.healthStructure.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  }

  verifyStructure(id, adminId) {
    return prisma.$transaction(async (tx) => {
      const structure = await tx.healthStructure.update({
        where: { id },
        data: {
          isVerified: true,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
        select: { id: true, name: true, status: true, verifiedAt: true },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: "STRUCTURE_VERIFIED",
          entityType: "HEALTH_STRUCTURE",
          entityId: id,
        },
      });

      return structure;
    });
  }

  suspendStructure(id, adminId, reason) {
    return prisma.$transaction(async (tx) => {
      const structure = await tx.healthStructure.update({
        where: { id },
        data: { status: "SUSPENDED", isVerified: false },
        select: { id: true, name: true, status: true },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId, // ✅ C'est maintenant l'ID de l'Admin
          action: "STRUCTURE_SUSPENDED",
          entityType: "HEALTH_STRUCTURE",
          entityId: id,
          details: reason ? JSON.stringify({ reason }) : null,
        },
      });

      return structure;
    });
  }

  // ─── Audit Logs ────────────────────────────────────────────

  findAuditLogs({ entityType, entityId, userId, action, page, limit }) {
    const where = {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(action && { action: { contains: action, mode: "insensitive" } }),
    };

    return Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          details: true,
          ipAddress: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  }

  findStructureById(id) {
    return prisma.healthStructure.findUnique({
      where: { id },
      select: { id: true },
    });
  }
}

export default new AdminRepository();
