import jambaarsService from "./jambaar.service.js";

class JambaarsController {

  // GET /jambaar/me
  async getMyProfile(req, res, next) {
    try {
      const result = await jambaarsService.getMyProfile(req.user.id);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /jambaar/me/badges
  async getMyBadges(req, res, next) {
    try {
      const result = await jambaarsService.getMyBadges(req.user.id);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /jambaar/leaderboard
  async getLeaderboard(req, res, next) {
    try {
      const result = await jambaarsService.getLeaderboard(
        req.validated.query,
        req.user.id
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export default new JambaarsController();