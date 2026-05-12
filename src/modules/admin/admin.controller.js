import adminService from "./admin.service.js";

class AdminController {

  // GET /admin/dashboard
  async getDashboard(req, res, next) {
    try {
      const kpis = await adminService.getDashboard();
      res.status(200).json({ success: true, kpis });
    } catch (err) {
      next(err);
    }
  }

  // GET /admin/users
  async getUsers(req, res, next) {
    try {
      const { data, total } = await adminService.getUsers(req.validated.query);
      res.status(200).json({ success: true, users: data, total });
    } catch (err) {
      next(err);
    }
  }

  // GET /admin/users/:id
  async getUserById(req, res, next) {
    try {
      const user = await adminService.getUserById(req.validated.params.id);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /admin/users/:id/suspend
  async suspendUser(req, res, next) {
    try {
      const user = await adminService.suspendUser(
        req.validated.params.id,
        req.validated.body?.reason,
      );
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /admin/users/:id/reactivate
  async reactivateUser(req, res, next) {
    try {
      const user = await adminService.reactivateUser(req.validated.params.id);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // GET /admin/health-structures
  async getStructures(req, res, next) {
    try {
      const { data, total } = await adminService.getStructures(
        req.validated.query,
      );
      res.status(200).json({ success: true, structures: data, total });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /admin/health-structures/:id/verify
  async verifyStructure(req, res, next) {
    try {
      const structure = await adminService.verifyStructure(
        req.validated.params.id,
      );
      res.status(200).json({ success: true, structure });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /admin/health-structures/:id/suspend
  async suspendStructure(req, res, next) {
    try {
      const structure = await adminService.suspendStructure(
        req.validated.params.id,
        req.validated.body?.reason,
      );
      res.status(200).json({ success: true, structure });
    } catch (err) {
      next(err);
    }
  }

  // GET /admin/audit-logs
  async getAuditLogs(req, res, next) {
    try {
      const { data, total } = await adminService.getAuditLogs(
        req.validated.query,
      );
      res.status(200).json({ success: true, logs: data, total });
    } catch (err) {
      next(err);
    }
  }
}

export default new AdminController();