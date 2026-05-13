import rewardService from "./reward.service.js";

class RewardController {
  // GET /rewards
  async listRewards(req, res, next) {
    try {
      const result =
        req.user.role === "ADMIN"
          ? await rewardService.listAllRewards()
          : await rewardService.listAvailableRewards();

      res.status(200).json({ success: true, rewards: result });
    } catch (err) {
      next(err);
    }
  }

  // GET /rewards/:id
  async getRewardById(req, res, next) {
    try {
      const reward = await rewardService.getRewardById(
        req.params.id,
        req.user.role,
      );
      res.status(200).json({ success: true, reward });
    } catch (err) {
      next(err);
    }
  }

  // POST /rewards
  async createReward(req, res, next) {
    try {
      const reward = await rewardService.createReward(req.validated.body);
      res.status(201).json({ success: true, reward });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /rewards/:id
  async updateReward(req, res, next) {
    try {
      const reward = await rewardService.updateReward(
        req.validated.params.id,
        req.validated.body,
      );
      res.status(200).json({ success: true, reward });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /rewards/:id
  async deactivateReward(req, res, next) {
    try {
      const reward = await rewardService.deactivateReward(
        req.validated.params.id,
      );
      res.status(200).json({ success: true, reward });
    } catch (err) {
      next(err);
    }
  }
}

export default new RewardController();
