import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

const BLOOD_REQUEST_SELECT = {
  id: true,
  bloodType: true,
  quantityNeeded: true,
  quantityProvided: true,
  urgencyLevel: true,
  serviceUnit: true,
  clinicalContext: true,
  status: true,
  cntsNotes: true,
  escalatedAlertId: true,
  fulfilledAt: true,
  createdAt: true,
  updatedAt: true,
  requestingHospital: {
    select: { id: true, name: true, address: true, region: true },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  handledByCnts: {
    select: { id: true, name: true, region: true },
  },
  handledBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  escalatedAlert: {
    select: { id: true, status: true, createdAt: true },
  },
};

class BloodRequestRepository extends BaseRepository {
  constructor() {
    super(prisma.bloodRequest);
  }

  create(data) {
    return this.model.create({
      data,
      select: BLOOD_REQUEST_SELECT,
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: BLOOD_REQUEST_SELECT,
    });
  }

  // Vue hôpital — ses propres demandes
  findByHospital(hospitalId, { page, limit, status }) {
    const where = {
      requestingHospitalId: hospitalId,
      ...(status && { status }),
    };
    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: BLOOD_REQUEST_SELECT,
    });
  }

  // Vue CNTS — demandes reçues par cette CNTS
  findByCnts(cntsId, { page, limit, status }) {
    const where = {
      handledByCntsId: cntsId,
      ...(status && { status }),
    };
    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: BLOOD_REQUEST_SELECT,
    });
  }

  updateStatus(id, data) {
    return this.model.update({
      where: { id },
      data,
      select: BLOOD_REQUEST_SELECT,
    });
  }
}

export default new BloodRequestRepository();
