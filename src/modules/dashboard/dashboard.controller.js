import dashboardService from "./dashboard.service.js";

class DashboardController {
  // GET /dashboard/cnts
  async getCntsDashboard(req, res, next) {
    try {
      const dashboard = await dashboardService.getCntsDashboard(
        req.user,
        req.validated.query,
      );
      res.status(200).json({ success: true, dashboard });
    } catch (err) {
      next(err);
    }
  }

  // GET /dashboard/hospital
  async getHospitalDashboard(req, res, next) {
    try {
      const dashboard = await dashboardService.getHospitalDashboard(
        req.user,
        req.validated.query,
      );
      res.status(200).json({ success: true, dashboard });
    } catch (err) {
      next(err);
    }
  }
}

export default new DashboardController();
