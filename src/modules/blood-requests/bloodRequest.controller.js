import bloodRequestService from "./bloodRequest.service.js";

class BloodRequestController {
  async createRequest(req, res, next) {
    try {
      const request = await bloodRequestService.createRequest(
        req.validated.body,
        req.user,
      );
      res.status(201).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  async handleRequest(req, res, next) {
    try {
      const request = await bloodRequestService.handleRequest(
        req.validated.params.id,
        req.validated.body,
        req.user,
      );
      res.status(200).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  async getRequests(req, res, next) {
    try {
      const result = await bloodRequestService.getRequests(
        req.user,
        req.validated.query,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const request = await bloodRequestService.getById(
        req.validated.params.id,
        req.user,
      );
      res.status(200).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  async cancelRequest(req, res, next) {
    try {
      const request = await bloodRequestService.cancelRequest(
        req.validated.params.id,
        req.user,
      );
      res.status(200).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }
}

export default new BloodRequestController();
