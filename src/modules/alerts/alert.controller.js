import alertService from "./alert.service.js";

class AlertController {

  // POST /alerts
  async createAlert(req, res, next) {
    try {
      const result = await alertService.createAlert(req.validated.body, req.user);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /alerts?lat=..&lng=..
  async getNearbyAlerts(req, res, next) {
    try {
      const alerts = await alertService.getNearbyAlerts(req.validated.query, req.user);
      res.status(200).json({ success: true, alerts });
    } catch (err) {
      next(err);
    }
  }

  // GET /alerts/my-structure
  async getMyStructureAlerts(req, res, next) {
    try {
      const result = await alertService.getMyStructureAlerts(
        req.user,
        req.validated.query
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /alerts/:id
  async getAlertById(req, res, next) {
    try {
      const alert = await alertService.getAlertById(req.params.id);
      res.status(200).json({ success: true, alert });
    } catch (err) {
      next(err);
    }
  }

  // GET /alerts/:id/responses
  async getAlertResponses(req, res, next) {
    try {
      const result = await alertService.getAlertResponses(req.params.id, req.user);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /alerts/:id/close
  async closeAlert(req, res, next) {
    try {
      const alert = await alertService.closeAlert(req.params.id, req.user);
      res.status(200).json({ success: true, alert });
    } catch (err) {
      next(err);
    }
  }
}

export default new AlertController();