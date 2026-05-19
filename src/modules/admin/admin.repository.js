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

  // ─── Statistiques Mensuelles ────────────────────────────────

  async getMonthlyStats(year) {
    // On utilise DATE_TRUNC de PostgreSQL pour grouper par mois
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

    // 1. Dons par mois
    const donationsByMonth = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', "donatedAt"), 'Mon') AS month,
        COUNT(*)::int AS donations
      FROM donations
      WHERE "donatedAt" >= ${startDate} AND "donatedAt" <= ${endDate} AND "isDone" = true
      GROUP BY DATE_TRUNC('month', "donatedAt")
      ORDER BY DATE_TRUNC('month', "donatedAt") ASC
    `;

    // 2. Alertes par mois
    const alertsByMonth = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') AS month,
        COUNT(*)::int AS alerts
      FROM alerts
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `;

    // 3. Vies sauvées par mois (depuis JambaarsProfile mis à jour lors des dons)
    const livesByMonth = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', d."donatedAt"), 'Mon') AS month,
        COALESCE(SUM(jp."livesSavedEstimate"), 0)::int AS "livesSaved"
      FROM donations d
      JOIN users u ON u.id = d."donorId"
      JOIN jambars_profiles jp ON jp."userId" = u.id
      WHERE d."donatedAt" >= ${startDate} AND d."donatedAt" <= ${endDate} AND d."isDone" = true
      GROUP BY DATE_TRUNC('month', d."donatedAt")
      ORDER BY DATE_TRUNC('month', d."donatedAt") ASC
    `;

    // 4. Fusionner les données dans un seul tableau structuré
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

    // Initialiser tous les mois de l'année à 0
    monthsOrder.forEach((m, index) => {
      statsMap[m] = {
        month: localizedMonths[index],
        donations: 0,
        alerts: 0,
        livesSaved: 0,
      };
    });

    // Remplir avec les vraies données
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

    // ─── Heatmap par Région (Ville) ─────────────────────────────

  async getRegionStats() {
    // 1. Compter les donneurs actifs par ville
    const donorsByCity = await prisma.jambaarsProfile.groupBy({
      by: ['city'],
      where: { 
        city: { not: null },
        user: { role: 'DONOR', isActive: true } 
      },
      _count: { city: true },
    });

    // 2. Calculer le niveau de demande (nombre d'alertes) par ville de structure
    const alertsByCity = await prisma.alert.groupBy({
      by: ['healthStructureId'],
      _count: { id: true },
    });

    // Récupérer les villes des structures pour mapper les IDs
    const structures = await prisma.healthStructure.findMany({
      select: { id: true, address: true },
    });

    // 3. Mapper les alertes vers les villes
    const alertsByCityMap = {};
    const cityRegex = /Dakar|Thiès|Saint-Louis|Ziguinchor|Kaolack|Diourbel|Tambacounda|Louga|Fatick|Kolda|Matam|Sédhiou|Kédougou|Kaffrine/gi;

    alertsByCity.forEach(alertGroup => {
      const structure = structures.find(s => s.id === alertGroup.healthStructureId);
      if (structure) {
        // Extraction basique de la ville depuis l'adresse (ex: "Avenue X, Dakar")
        const match = structure.address.match(cityRegex);
        const city = match ? match[0] : 'Autre';
        
        if (!alertsByCityMap[city]) alertsByCityMap[city] = 0;
        alertsByCityMap[city] += alertGroup._count.id;
      }
    });

    // 4. Fusionner les données et calculer le demandLevel (0-100)
    const allCities = new Set([
      ...donorsByCity.map(d => d.city),
      ...Object.keys(alertsByCityMap)
    ]);

    // Trouver le max d'alertes pour normaliser le niveau de demande (0-100)
    const maxAlerts = Math.max(...Object.values(alertsByCityMap), 1);

    const data = Array.from(allCities).map(city => {
      const donorData = donorsByCity.find(d => d.city === city);
      const donorsCount = donorData?._count.city || 0;
      const demandCount = alertsByCityMap[city] || 0;

      // Le demandLevel est un pourcentage (0 à 100) basé sur le nombre d'alertes
      // par rapport à la zone la plus active
      const demandLevel = Math.round((demandCount / maxAlerts) * 100);

      return {
        region: city,
        demandLevel,
        donorsCount,
      };
    });

    // Trier par niveau de demande décroissant (les zones les plus chaudes en premier)
    return data.sort((a, b) => b.demandLevel - a.demandLevel);
  }
}

export default new AdminRepository();
