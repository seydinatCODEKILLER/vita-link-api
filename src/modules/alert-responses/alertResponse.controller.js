import alertResponseService from "./alertResponse.service.js";

class AlertResponseController {
  // POST /confirm
  async confirm(req, res, next) {
    try {
      const result = await alertResponseService.confirm(
        req.validated.params.alertId,
        req.user.id,
        req.validated.body
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /decline
  async decline(req, res, next) {
    try {
      const result = await alertResponseService.decline(
        req.validated.params.alertId,
        req.user.id
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /arrived
  async markArrived(req, res, next) {
    try {
      const result = await alertResponseService.markArrived(
        req.validated.params.alertId,
        req.validated.body.donorId,     // ← donorId depuis le body
        req.user.id                      // agentId
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /no-show
  async markNoShow(req, res, next) {
    try {
      const result = await alertResponseService.markNoShow(
        req.validated.params.alertId,
        req.validated.body.donorId,     // ← donorId depuis le body
        req.user.id                      // agentId
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export default new AlertResponseController();