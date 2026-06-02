import { prisma } from "../../config/database.js";

class DashboardRepository {
  // ─── KPIs & Données CNTS ───────────────────────────────────
  async getCntsDashboardData(cntsId, recentRequestsLimit = 5) {
    // 1. KPIs rapides en parallèle
    const [pendingRequests, criticalStocks, activeAlerts, totalDonations] =
      await Promise.all([
        prisma.bloodRequest.count({
          where: { handledByCntsId: cntsId, status: "PENDING" },
        }),
        prisma.bloodStock.count({
          where: { healthStructureId: cntsId, level: "CRITICAL" },
        }),
        prisma.alert.count({
          where: { healthStructureId: cntsId, status: "ACTIVE" },
        }),
        prisma.donation.count({
          where: { healthStructureId: cntsId, isDone: true },
        }),
      ]);

    // 2. Stock sanguin complet de la CNTS
    const bloodStocks = await prisma.bloodStock.findMany({
      where: { healthStructureId: cntsId },
      select: { bloodType: true, quantity: true, level: true },
      orderBy: { bloodType: "asc" },
    });

    // 3. Les dernières demandes des hôpitaux (à traiter)
    const recentRequests = await prisma.bloodRequest.findMany({
      where: { handledByCntsId: cntsId, status: "PENDING" },
      take: recentRequestsLimit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bloodType: true,
        quantityNeeded: true,
        urgencyLevel: true,
        status: true,
        createdAt: true,
        requestingHospital: { select: { id: true, name: true, region: true } },
      },
    });

    return {
      kpis: { pendingRequests, criticalStocks, activeAlerts, totalDonations },
      bloodStocks,
      recentRequests,
    };
  }

  // ─── KPIs & Données HÔPITAL ────────────────────────────────
  async getHospitalDashboardData(
    hospitalId,
    affiliatedCntsId,
    myRequestsLimit = 5,
  ) {
    // 1. KPIs rapides en parallèle
    const [pendingRequests, activeDirectAlerts, totalDonations] =
      await Promise.all([
        prisma.bloodRequest.count({
          where: { requestingHospitalId: hospitalId, status: "PENDING" },
        }),
        prisma.alert.count({
          where: {
            healthStructureId: hospitalId,
            status: "ACTIVE",
            origin: "HOSPITAL_DIRECT",
          },
        }),
        prisma.donation.count({
          where: { healthStructureId: hospitalId, isDone: true },
        }),
      ]);

    // 2. Les demandes en cours de cet hôpital
    const myRequests = await prisma.bloodRequest.findMany({
      where: {
        requestingHospitalId: hospitalId,
        status: {
          in: ["PENDING", "PARTIALLY_FULFILLED", "ESCALATED_TO_ALERT"],
        },
      },
      take: myRequestsLimit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bloodType: true,
        quantityNeeded: true,
        quantityProvided: true,
        status: true,
        urgencyLevel: true,
        createdAt: true,
      },
    });

    // 3. Le stock de la CNTS affiliée (lecture seule pour l'hôpital)
    let cntsStock = [];
    if (affiliatedCntsId) {
      cntsStock = await prisma.bloodStock.findMany({
        where: { healthStructureId: affiliatedCntsId },
        select: { bloodType: true, quantity: true, level: true },
        orderBy: { bloodType: "asc" },
      });
    }

    return {
      kpis: { pendingRequests, activeDirectAlerts, totalDonations },
      myRequests,
      cntsStock,
    };
  }
}

export default new DashboardRepository();
