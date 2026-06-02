import dashboardRepository from "./dashboard.repository.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";

class DashboardService {
  // ── GET /dashboard/cnts ─────────────────────────────────────
  async getCntsDashboard(user, query) {
    // Sécurité : vérifier que c'est bien une CNTS
    if (user.employerStructure?.structureType !== "CNTS") {
      throw new ForbiddenError("Accès réservé aux agents de la CNTS");
    }

    const limit = query?.recentRequestsLimit ?? 5;
    return dashboardRepository.getCntsDashboardData(
      user.healthStructureId,
      limit,
    );
  }

  // ── GET /dashboard/hospital ─────────────────────────────────
  async getHospitalDashboard(user, query) {
    // Sécurité : vérifier que c'est bien un hôpital/centre de santé
    const structureType = user.employerStructure?.structureType;
    if (structureType !== "HOSPITAL" && structureType !== "HEALTH_CENTER") {
      throw new ForbiddenError("Accès réservé aux établissements de soins");
    }

    const limit = query?.myRequestsLimit ?? 5;
    const affiliatedCntsId = user.employerStructure?.affiliatedCntsId ?? null;

    return dashboardRepository.getHospitalDashboardData(
      user.healthStructureId,
      affiliatedCntsId,
      limit,
    );
  }
}

export default new DashboardService();
