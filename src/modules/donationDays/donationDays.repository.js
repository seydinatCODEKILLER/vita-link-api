import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

export const DONATION_DAY_SELECT = {
  id: true,
  title: true,
  description: true,
  photoUrl: true,
  address: true,
  latitude: true,
  longitude: true,
  scheduledDate: true,
  startTime: true,
  endTime: true,
  targetDonors: true,
  bloodTypesNeeded: true,
  status: true,
  publishedAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  healthStructure: { select: { id: true, name: true, address: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  
  _count: { 
    select: { 
      registrations: { 
        where: { status: { not: "CANCELLED" } } 
      } 
    } 
  },
};

class DonationDayRepository extends BaseRepository {
  constructor() {
    super(prisma.donationDay);
  }

  // ─── Lecture ───────────────────────────────────────────────

  async findMyStructureDays(
    structureId,
    { page = 1, limit = 20, status } = {},
  ) {
    const where = { healthStructureId: structureId, ...(status && { status }) };
    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledDate: "desc" },
        select: DONATION_DAY_SELECT,
      }),
      this.model.count({ where }),
    ]);
    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAllForAdmin({
    page = 1,
    limit = 50,
    status,
    startDate,
    endDate,
  } = {}) {
    const scheduledDateFilter = {};
    if (startDate) scheduledDateFilter.gte = new Date(startDate);
    if (endDate) scheduledDateFilter.lte = new Date(endDate);

    const where = {
      ...(status && { status }),
      ...(Object.keys(scheduledDateFilter).length > 0 && {
        scheduledDate: scheduledDateFilter,
      }),
    };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: DONATION_DAY_SELECT,
      }),
      this.model.count({ where }),
    ]);
    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: {
        ...DONATION_DAY_SELECT,
        registrations: {
          orderBy: { registeredAt: "desc" },
          select: {
            id: true,
            status: true,
            timeSlot: true,
            registeredAt: true,
            attendedAt: true,
            cancelledAt: true,
            donor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                bloodType: true,
              },
            },
          },
        },
      },
    });
  }

  findRegistration(registrationId) {
    return prisma.donationDayRegistration.findUnique({
      where: { id: registrationId },
    });
  }

  findExistingRegistration(donationDayId, donorId) {
    return prisma.donationDayRegistration.findUnique({
      where: { donationDayId_donorId: { donationDayId, donorId } },
    });
  }

  // Récupérer les inscriptions à venir d'un donneur
  async findMyUpcomingRegistrations(donorId, { page = 1, limit = 20 } = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      donorId,
      status: "REGISTERED",
      donationDay: { scheduledDate: { gte: today }, status: "PUBLISHED" },
    };

    const [data, total] = await Promise.all([
      prisma.donationDayRegistration.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { donationDay: { scheduledDate: "asc" } },
        select: {
          id: true,
          status: true,
          timeSlot: true,
          registeredAt: true,
          donationDay: { select: DONATION_DAY_SELECT },
        },
      }),
      prisma.donationDayRegistration.count({ where }),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findNearbyPublished(donorBloodType, { page = 1, limit = 20 } = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      status: "PUBLISHED",
      scheduledDate: { gte: today },
      OR: [
        { bloodTypesNeeded: { isEmpty: true } },
        ...(donorBloodType
          ? [{ bloodTypesNeeded: { has: donorBloodType } }]
          : []),
      ],
    };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledDate: "asc" },
        select: DONATION_DAY_SELECT,
      }),
      this.model.count({ where }),
    ]);
    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Mutations ─────────────────────────────────────────────

  createDay(data) {
    return this.model.create({ data, select: DONATION_DAY_SELECT });
  }

  updateDay(id, data) {
    return this.model.update({
      where: { id },
      data,
      select: DONATION_DAY_SELECT,
    });
  }

  createRegistration(data) {
    return prisma.donationDayRegistration.create({ data });
  }

  updateRegistration(id, data) {
    return prisma.donationDayRegistration.update({ where: { id }, data });
  }

  async findStructureDayByDate(structureId, scheduledDate) {
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.model.findFirst({
      where: {
        healthStructureId: structureId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ["CANCELLED"],
        },
      },
    });
  }

  findDonorEligibility(donorId) {
    return prisma.user.findUnique({
      where: { id: donorId },
      select: {
        bloodType: true,
        jambaarsProfile: {
          select: {
            nextEligibilityAt: true,
          },
        },
      },
    });
  }

  findActiveRegistration(donorId) {
    return prisma.donationDayRegistration.findFirst({
      where: {
        donorId,
        status: "REGISTERED",
        donationDay: {
          scheduledDate: { gte: new Date() },
          status: "PUBLISHED",
        },
      },
      select: {
        id: true,
        donationDay: {
          select: {
            title: true,
            scheduledDate: true,
          },
        },
      },
    });
  }
}

export default new DonationDayRepository();
