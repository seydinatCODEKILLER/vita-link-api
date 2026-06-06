import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

const PURCHASE_ORDER_SELECT = {
  id: true,
  code: true,
  bloodType: true,
  quantity: true,
  status: true,
  expiresAt: true,
  scannedAt: true,
  createdAt: true,
  updatedAt: true,
  bloodRequest: {
    select: { id: true, urgencyLevel: true, serviceUnit: true },
  },
  cnts: {
    select: { id: true, name: true, address: true },
  },
  hospital: {
    select: { id: true, name: true, address: true },
  },
  scannedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super(prisma.purchaseOrder);
  }

  create(data) {
    return this.model.create({
      data,
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findByCode(code) {
    return this.model.findUnique({
      where: { code },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findByBloodRequest(bloodRequestId) {
    return this.model.findUnique({
      where: { bloodRequestId },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  // Vue hôpital — ses propres bons
  findByHospital(hospitalId, { page, limit, status }) {
    const where = {
      hospitalId,
      ...(status && { status }),
    };
    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  // Vue CNTS — bons à valider
  findByCnts(cntsId, { page, limit, status }) {
    const where = {
      cntsId,
      ...(status && { status }),
    };
    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  markAsUsed(id, scannedByUserId) {
    return this.model.update({
      where: { id },
      data: {
        status: "USED",
        scannedByUserId,
        scannedAt: new Date(),
      },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  expireStaleOrders() {
    return this.model.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }

  // ── Nouvelle méthode transactionnelle ──
  async confirmExpiry(id, wasDelivered, cntsNotes, scannedByUserId) {
    return prisma.$transaction(async (tx) => {
      // 1. Mettre à jour le bon
      const order = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: wasDelivered ? "USED" : "CANCELLED", // USED si remis, CANCELLED sinon
          cntsNotes: cntsNotes || null,
          scannedByUserId: wasDelivered ? scannedByUserId : null,
          scannedAt: wasDelivered ? new Date() : null,
        },
        select: PURCHASE_ORDER_SELECT,
      });

      // 2. Si le sang N'A PAS été remis, on restitue le stock
      if (!wasDelivered) {
        // ⚠️ Adapte "cntsId_bloodType" selon ton schéma Prisma (composite unique id du BloodStock)
        await tx.bloodStock.update({
          where: {
            healthStructureId_bloodType: {
              healthStructureId: order.cnts.id,
              bloodType: order.bloodType,
            },
          },
          data: {
            quantity: { increment: order.quantity },
          },
        });
      }

      return order;
    });
  }
}

export default new PurchaseOrderRepository();
