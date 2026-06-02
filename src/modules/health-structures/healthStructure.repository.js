import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Select partagé ───────────────────────────────────────────
const STRUCTURE_SELECT = {
  id: true,
  name: true,
  structureType: true,
  registrationNumber: true,
  address: true,
  region: true,
  latitude: true,
  longitude: true,
  phone: true,
  email: true,
  isVerified: true,
  status: true,
  affiliatedCntsId: true,
  verifiedAt: true,
  createdAt: true,
};

const STAFF_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true, // Sera CNTS_AGENT ou HOSPITAL_AGENT
  isStructureAdmin: true,
  isActive: true,
  createdAt: true,
};

class HealthStructureRepository extends BaseRepository {
  constructor() {
    super(prisma.healthStructure);
  }

  // ─── Lecture ───────────────────────────────────────────────

  findAll() {
    return this.model.findMany({
      select: {
        ...STRUCTURE_SELECT,
        _count: {
          select: {
            staffMembers: true,
            alerts: true,
            donations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: {
        ...STRUCTURE_SELECT,
        _count: {
          select: {
            staffMembers: true,
            alerts: true,
            donations: true,
          },
        },
      },
    });
  }

  findByUserId(userId) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        healthStructureId: true,
        isStructureAdmin: true,
        employerStructure: {
          select: {
            ...STRUCTURE_SELECT,
            affiliatedCnts: {
              select: { id: true, name: true, phone: true, email: true },
            },
            _count: {
              select: {
                staffMembers: true,
                alerts: true,
                donations: true,
              },
            },
          },
        },
      },
    });
  }

  // ─── Staff ─────────────────────────────────────────────────

  findStaff(structureId) {
    return this.prisma.user.findMany({
      where: { healthStructureId: structureId },
      select: STAFF_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findStaffMember(userId, structureId) {
    return this.prisma.user.findFirst({
      where: { id: userId, healthStructureId: structureId },
      select: STAFF_SELECT,
    });
  }

  addStaff(data) {
    return this.prisma.user.create({
      data,
      select: STAFF_SELECT,
    });
  }

  removeStaff(userId) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        healthStructureId: null,
        isStructureAdmin: false,
      },
      select: { id: true },
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  updateStructure(structureId, data) {
    return this.model.update({
      where: { id: structureId },
      data,
      select: STRUCTURE_SELECT,
    });
  }

  // ─── Stats ─────────────────────────────────────────────────

  async getStats(structureId, structureType) {
    const baseQueries = [
      this.prisma.donation.count({
        where: { healthStructureId: structureId, isDone: true },
      }),
      this.prisma.$queryRaw`
      SELECT AVG(
        EXTRACT(EPOCH FROM (ar."arrivedAt" - a."createdAt")) / 60
      ) as avg_minutes
      FROM alert_responses ar
      JOIN alerts a ON a.id = ar."alertId"
      WHERE a."healthStructureId" = ${structureId}::uuid
        AND ar."arrivedAt" IS NOT NULL
    `,
      this.prisma.alert.groupBy({
        by: ["status"],
        where: { healthStructureId: structureId },
        _count: { status: true },
      }),
    ];

    if (structureType === "CNTS") {
      baseQueries.push(
        this.prisma.bloodStock.findMany({
          where: { healthStructureId: structureId },
          select: {
            bloodType: true,
            quantity: true,
            level: true,
            lastSuppliedAt: true,
          },
        }),
      );
    }

    const [totalDonations, avgResponseTime, alertStats, bloodStocks] =
      await Promise.all(baseQueries);

    const avgMinutes = avgResponseTime[0]?.avg_minutes
      ? Math.round(Number(avgResponseTime[0].avg_minutes))
      : null;

    const alertsByStatus = alertStats.reduce((acc, s) => {
      acc[s.status] = s._count.status;
      return acc;
    }, {});

    return {
      totalDonations,
      avgResponseTimeMinutes: avgMinutes,
      alerts: alertsByStatus,
      ...(structureType === "CNTS" && { bloodStocks: bloodStocks ?? [] }),
    };
  }

  findAffiliatedHospitals(cntsId, filters = {}) {
    return this.model.findMany({
      where: {
        affiliatedCntsId: cntsId,
        structureType: { in: ["HOSPITAL", "HEALTH_CENTER"] },
        ...(filters.status && { status: filters.status }),
      },
      select: {
        id: true,
        name: true,
        structureType: true,
        status: true,
        address: true,
        region: true,
        phone: true,
        email: true,
        _count: { select: { staffMembers: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async findAvailableCnts() {
    return prisma.healthStructure.findMany({
      where: {
        structureType: "CNTS",
        status: "VERIFIED", // Sécurité importante !
      },
      select: {
        id: true,
        name: true,
        region: true,
        address: true,
      },
      orderBy: {
        region: "asc", // Tri par région pour faciliter la recherche sur mobile
      },
    });
  }
}

export default new HealthStructureRepository();
