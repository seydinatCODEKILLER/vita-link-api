import healthStructureService from "./healthStructure.service.js";

class HealthStructureController {
  // GET /health-structures
  async getAll(req, res, next) {
    try {
      const structures = await healthStructureService.getAll();
      res.status(200).json({ success: true, structures });
    } catch (err) {
      next(err);
    }
  }

  // GET /health-structures/:id
  async getById(req, res, next) {
    try {
      const structure = await healthStructureService.getById(
        req.validated.params.id,
      );
      res.status(200).json({ success: true, structure });
    } catch (err) {
      next(err);
    }
  }

  // GET /health-structures/me
  async getMyStructure(req, res, next) {
    try {
      const structure = await healthStructureService.getMyStructure(
        req.user.id,
      );
      res.status(200).json({ success: true, structure });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /health-structures/me
  async updateMyStructure(req, res, next) {
    try {
      const structure = await healthStructureService.updateMyStructure(
        req.user.id,
        req.user.isStructureAdmin,
        req.validated.body,
      );
      res.status(200).json({ success: true, structure });
    } catch (err) {
      next(err);
    }
  }

  // POST /health-structures/me/staff
  async addStaff(req, res, next) {
    try {
      const agent = await healthStructureService.addStaff(
        req.user.id,
        req.user.isStructureAdmin,
        req.user.healthStructureId,
        req.validated.body,
      );
      res.status(201).json({ success: true, agent });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /health-structures/me/staff/:userId
  async removeStaff(req, res, next) {
    try {
      const result = await healthStructureService.removeStaff(
        req.user.id,
        req.user.isStructureAdmin,
        req.user.healthStructureId,
        req.validated.params.userId,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /health-structures/me/staff
  async getStaff(req, res, next) {
    try {
      const staff = await healthStructureService.getStaff(
        req.user.id,
        req.user.isStructureAdmin,
        req.user.healthStructureId,
      );
      res.status(200).json({ success: true, staff });
    } catch (err) {
      next(err);
    }
  }

  // GET /health-structures/me/stats
  async getStats(req, res, next) {
    try {
      const stats = await healthStructureService.getStats(
        req.user.id,
        req.user.healthStructureId,
      );
      res.status(200).json({ success: true, stats });
    } catch (err) {
      next(err);
    }
  }
}

export default new HealthStructureController();
