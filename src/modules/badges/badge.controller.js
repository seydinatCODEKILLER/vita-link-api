import badgeService from "./badge.service.js";

class BadgeController {
  // GET /badges
  async listBadges(req, res, next) {
    try {
      const badges = await badgeService.listBadges();
      res.status(200).json({ success: true, badges });
    } catch (err) {
      next(err);
    }
  }

  // POST /badges
  async createBadge(req, res, next) {
    try {
      const badge = await badgeService.createBadge(req.validated.body);
      res.status(201).json({ success: true, badge });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /badges/:id
  async updateBadge(req, res, next) {
    try {
      const badge = await badgeService.updateBadge(
        req.validated.params.id,
        req.validated.body,
      );
      res.status(200).json({ success: true, badge });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /badges/:id
  async deactivateBadge(req, res, next) {
    try {
      const badge = await badgeService.deactivateBadge(req.validated.params.id);
      res.status(200).json({ success: true, badge });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /badges/:id/reactivate
  async reactivateBadge(req, res, next) {
    try {
      const badge = await badgeService.reactivateBadge(req.validated.params.id);

      res.status(200).json({
        success: true,
        badge,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new BadgeController();
