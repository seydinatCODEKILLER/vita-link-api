import couponService from "./coupon.service.js";

class CouponController {

  // POST /coupons/redeem/:rewardId
  async redeemReward(req, res, next) {
    try {
      const coupon = await couponService.redeemReward(
        req.user.id,
        req.validated.params.rewardId
      );
      res.status(201).json({ success: true, coupon });
    } catch (err) {
      next(err);
    }
  }

  // GET /coupons/me
  async getMyCoupons(req, res, next) {
    try {
      const result = await couponService.getMyCoupons(
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /coupons/:id/use
  async useCoupon(req, res, next) {
    try {
      const coupon = await couponService.useCoupon(
        req.validated.params.id,
        req.user
      );
      res.status(200).json({ success: true, coupon });
    } catch (err) {
      next(err);
    }
  }
}

export default new CouponController();