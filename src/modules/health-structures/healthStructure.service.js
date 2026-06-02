import healthStructureRepository from "./healthStructure.repository.js";
import { hashPassword } from "../../shared/utils/hasher.utils.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

class HealthStructureService {
  // ── GET /health-structures (Admin) ──────────────────────────
  async getAll() {
    return healthStructureRepository.findAll();
  }

  // ── GET /health-structures/:id ───────────────────────────────
  async getById(id) {
    const structure = await healthStructureRepository.findById(id);
    if (!structure) throw new NotFoundError("Structure de santé introuvable");
    return structure;
  }

  // ── GET /health-structures/me ────────────────────────────────
  async getMyStructure(userId) {
    const result = await healthStructureRepository.findByUserId(userId);

    if (!result?.employerStructure) {
      throw new NotFoundError(
        "Vous n'êtes rattaché à aucune structure de santé",
      );
    }

    return result.employerStructure;
  }

  // ── PATCH /health-structures/me ──────────────────────────────
  async updateMyStructure(userId, isStructureAdmin, userStructureType, data) {
    if (!isStructureAdmin) {
      throw new ForbiddenError(
        "Seul le directeur peut modifier les informations de la structure",
      );
    }

    // ← NOUVEAU : Sécurité d'affiliation
    if (data.affiliatedCntsId) {
      // Seul un HÔPITAL peut changer son affiliation
      if (userStructureType === "CNTS") {
        throw new BadRequestError(
          "Une CNTS ne peut pas être affiliée à une autre structure",
        );
      }
      // Vérifier que l'ID fourni est bien une CNTS
      const targetCnts = await healthStructureRepository.findById(
        data.affiliatedCntsId,
      );
      if (!targetCnts || targetCnts.structureType !== "CNTS") {
        throw new BadRequestError(
          "La structure d'affiliation spécifiée n'est pas une CNTS valide",
        );
      }
    }

    const result = await healthStructureRepository.findByUserId(userId);
    if (!result?.healthStructureId)
      throw new NotFoundError("Structure introuvable");

    const updated = await healthStructureRepository.updateStructure(
      result.healthStructureId,
      data,
    );

    logger.logEvent("STRUCTURE_UPDATED", {
      structureId: result.healthStructureId,
      updatedBy: userId,
    });
    return updated;
  }

  // ── POST /health-structures/me/staff ─────────────────────────
  async addStaff(
    userId,
    isStructureAdmin,
    healthStructureId,
    staffData,
    userStructureType,
  ) {
    if (!isStructureAdmin) {
      throw new ForbiddenError("Seul le directeur peut ajouter des agents");
    }

    const [emailTaken, phoneTaken] = await Promise.all([
      healthStructureRepository.prisma.user.findUnique({
        where: { email: staffData.email },
      }),
      healthStructureRepository.prisma.user.findUnique({
        where: { phone: staffData.phone },
      }),
    ]);

    if (emailTaken) throw new ConflictError("Cet email est déjà utilisé");
    if (phoneTaken) throw new ConflictError("Ce téléphone est déjà utilisé");

    const passwordHash = await hashPassword(staffData.password);

    // ← NOUVEAU : Déterminer le rôle de l'agent selon le type de structure
    let agentRole;
    if (userStructureType === "CNTS") {
      agentRole = staffData.isStructureAdmin ? "CNTS_ADMIN" : "CNTS_AGENT";
    } else {
      agentRole = "HOSPITAL_AGENT";
    }

    const agent = await healthStructureRepository.addStaff({
      firstName: staffData.firstName,
      lastName: staffData.lastName,
      email: staffData.email,
      phone: staffData.phone,
      passwordHash,
      role: agentRole, // ← Au lieu de "HEALTH_STRUCTURE"
      isActive: true,
      healthStructureId,
      isStructureAdmin: staffData.isStructureAdmin ?? false,
    });

    logger.logEvent("STAFF_ADDED", {
      agentId: agent.id,
      structureId: healthStructureId,
      addedBy: userId,
    });
    return agent;
  }

  // ── DELETE /health-structures/me/staff/:userId ───────────────
  async removeStaff(userId, isStructureAdmin, healthStructureId, targetUserId) {
    if (!isStructureAdmin) {
      throw new ForbiddenError("Seul le directeur peut retirer des agents");
    }

    // Empêcher le directeur de se retirer lui-même
    if (targetUserId === userId) {
      throw new BadRequestError(
        "Vous ne pouvez pas vous retirer vous-même de la structure",
      );
    }

    // Vérifier que l'agent appartient bien à cette structure
    const staffMember = await healthStructureRepository.findStaffMember(
      targetUserId,
      healthStructureId,
    );
    if (!staffMember) {
      throw new NotFoundError("Cet agent n'appartient pas à votre structure");
    }

    await healthStructureRepository.removeStaff(targetUserId);

    logger.logEvent("STAFF_REMOVED", {
      agentId: targetUserId,
      structureId: healthStructureId,
      removedBy: userId,
    });

    return { message: "Agent retiré avec succès" };
  }

  // ── GET /health-structures/me/staff ──────────────────────────
  async getStaff(userId, isStructureAdmin, healthStructureId) {
    if (!isStructureAdmin) {
      throw new ForbiddenError(
        "Seul le directeur peut consulter la liste des agents",
      );
    }

    return healthStructureRepository.findStaff(healthStructureId);
  }

  // ── GET /health-structures/me/stats ──────────────────────────
  async getStats(userId, healthStructureId) {
    if (!healthStructureId)
      throw new NotFoundError("Vous n'êtes rattaché à aucune structure");
    const structure =
      await healthStructureRepository.findById(healthStructureId);
    if (!structure) throw new NotFoundError("Structure introuvable");
    return healthStructureRepository.getStats(
      healthStructureId,
      structure.structureType,
    );
  }

  // ── GET /health-structures/me/affiliated-hospitals ───────────
  async getAffiliatedHospitals(
    userId,
    healthStructureId,
    userStructureType,
    filters,
  ) {
    if (userStructureType !== "CNTS") {
      throw new ForbiddenError(
        "Seule une CNTS peut consulter ses hôpitaux affiliés",
      );
    }

    return healthStructureRepository.findAffiliatedHospitals(
      healthStructureId,
      filters,
    );
  }

  async getAvailableCnts() {
    const cntsList = await healthStructureRepository.findAvailableCnts();

    logger.logEvent("CNTS_LIST_FETCHED", { count: cntsList.length });

    return cntsList;
  }
}

export default new HealthStructureService();
