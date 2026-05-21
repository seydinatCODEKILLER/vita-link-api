import { prisma } from "../../config/database.js";

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
      prisma.user.count({ where: { role: "DONOR", isActive: true } }),
      prisma.healthStructure.count({ where: { status: "VERIFIED" } }),
      prisma.donation.count({ where: { isDone: true } }),
      prisma.alert.count({ where: { status: "QUOTA_REACHED" } }),
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
      prisma.bloodStock.groupBy({
        by: ["healthStructureId"],
        where: { level: "CRITICAL" },
        _count: { healthStructureId: true },
      }),
      prisma.jambaarsProfile.aggregate({
        _sum: { livesSavedEstimate: true },
      }),
      prisma.healthStructure.count({ where: { status: "PENDING_REVIEW" } }),
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
          select: { id: true, name: true, status: true, region: true }, // <-- AJOUT region
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
          userId: adminId,
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
          userId: adminId,
          action: "USER_REACTIVATED",
          entityType: "USER",
          entityId: targetId,
        },
      });
      return user;
    });
  }

  // ─── Health Structures ─────────────────────────────────────

  findStructures({ status,region, page, limit }) {
      const where = { 
    ...(status && { status }),
    ...(region && { region })
  };

    return Promise.all([
      prisma.healthStructure.findMany({
        where,
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          address: true,
          region: true,
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
        data: { isVerified: true, status: "VERIFIED", verifiedAt: new Date() },
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
          userId: adminId,
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

  // ─── Alertes Récentes ────────────────────────────────────────

  async getRecentAlerts(limit = 10) {
    const alerts = await prisma.alert.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        bloodType: true,
        createdAt: true,
        healthStructure: {
          select: {
            name: true,
            region: true, // Proprement récupéré depuis la BDD
          },
        },
      },
    });

    return alerts.map((alert) => ({
      id: alert.id,
      structureName: alert.healthStructure.name,
      region: alert.healthStructure.region || "Non spécifiée", // Plus de Regex !
      bloodGroup: alert.bloodType.replace("_", ""),
      status: alert.status,
      createdAt: alert.createdAt,
    }));
  }

  // ─── Statistiques Mensuelles ────────────────────────────────

  async getMonthlyStats(year) {
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

    const donationsByMonth = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', "donatedAt"), 'Mon') AS month, COUNT(*)::int AS donations
      FROM donations WHERE "donatedAt" >= ${startDate} AND "donatedAt" <= ${endDate} AND "isDone" = true
      GROUP BY DATE_TRUNC('month', "donatedAt") ORDER BY DATE_TRUNC('month', "donatedAt") ASC
    `;

    const alertsByMonth = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') AS month, COUNT(*)::int AS alerts
      FROM alerts WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY DATE_TRUNC('month', "createdAt") ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `;

    const livesByMonth = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', d."donatedAt"), 'Mon') AS month, COALESCE(SUM(jp."livesSavedEstimate"), 0)::int AS "livesSaved"
      FROM donations d JOIN users u ON u.id = d."donorId" JOIN jambars_profiles jp ON jp."userId" = u.id
      WHERE d."donatedAt" >= ${startDate} AND d."donatedAt" <= ${endDate} AND d."isDone" = true
      GROUP BY DATE_TRUNC('month', d."donatedAt") ORDER BY DATE_TRUNC('month', d."donatedAt") ASC
    `;

    const monthsOrder = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const localizedMonths = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Aoû",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];

    const statsMap = {};
    monthsOrder.forEach((m, index) => {
      statsMap[m] = {
        month: localizedMonths[index],
        donations: 0,
        alerts: 0,
        livesSaved: 0,
      };
    });

    donationsByMonth.forEach((row) => {
      if (statsMap[row.month]) statsMap[row.month].donations = row.donations;
    });
    alertsByMonth.forEach((row) => {
      if (statsMap[row.month]) statsMap[row.month].alerts = row.alerts;
    });
    livesByMonth.forEach((row) => {
      if (statsMap[row.month])
        statsMap[row.month].livesSaved = Number(row.livesSaved);
    });

    return Object.values(statsMap);
  }

  // ─── Heatmap par Région ────────────────────────────────────

  async getRegionStats() {
    // 1. Compter les donneurs actifs par ville (depuis leur profil Jambaars)
    const donorsByCity = await prisma.jambaarsProfile.groupBy({
      by: ["city"],
      where: { city: { not: null }, user: { role: "DONOR", isActive: true } },
      _count: { city: true },
    });

    // 2. Compter les alertes par structure
    // (On groupe sur la table Alert, ce qui est autorisé par Prisma)
    const alertsByStructure = await prisma.alert.groupBy({
      by: ["healthStructureId"],
      _count: { id: true }, // Compte le nombre d'alertes par structure
    });

    // 3. Récupérer les régions des structures qui ont des alertes
    const structureIds = alertsByStructure.map((a) => a.healthStructureId);

    const structures = await prisma.healthStructure.findMany({
      where: {
        id: { in: structureIds },
        region: { not: null }, // On ignore les structures sans région renseignée
      },
      select: { id: true, region: true },
    });

    // 4. Agréger le nombre d'alertes par région
    const alertsByRegionMap = {};

    alertsByStructure.forEach((alertGroup) => {
      const structure = structures.find(
        (s) => s.id === alertGroup.healthStructureId,
      );
      if (structure && structure.region) {
        const region = structure.region;
        if (!alertsByRegionMap[region]) alertsByRegionMap[region] = 0;
        alertsByRegionMap[region] += alertGroup._count.id;
      }
    });

    // 5. Fusionner les données
    const allRegions = new Set([
      ...donorsByCity.map((d) => d.city),
      ...Object.keys(alertsByRegionMap),
    ]);

    const maxAlerts = Math.max(...Object.values(alertsByRegionMap), 1);

    const data = Array.from(allRegions).map((region) => {
      const donorData = donorsByCity.find((d) => d.city === region);
      const donorsCount = donorData?._count.city || 0;
      const demandCount = alertsByRegionMap[region] || 0;

      const demandLevel = Math.round((demandCount / maxAlerts) * 100);

      return { region, demandLevel, donorsCount };
    });

    return data.sort((a, b) => b.demandLevel - a.demandLevel);
  }
}

export default new AdminRepository();
