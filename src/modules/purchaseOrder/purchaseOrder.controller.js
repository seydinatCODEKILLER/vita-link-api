import purchaseOrderService from "./purchaseOrder.service.js";

class PurchaseOrderController {
  async getByBloodRequest(req, res, next) {
    try {
      const order = await purchaseOrderService.getByBloodRequest(
        req.params.bloodRequestId,
        req.user,
      );
      res.json({ success: true, order });
    } catch (err) {
      next(err);
    }
  }

  async scan(req, res, next) {
    try {
      const result = await purchaseOrderService.scan(req.params.code, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getList(req, res, next) {
    try {
      const result = await purchaseOrderService.getList(req.user, req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // ── POST /purchase-orders/:id/expire-confirm ──
  async confirmExpiry(req, res, next) {
    try {
      const { id } = req.params;
      const { wasDelivered, cntsNotes } = req.body;
      const user = req.user;

      const result = await purchaseOrderService.confirmExpiry(
        id,
        { wasDelivered, cntsNotes },
        user,
      );

      return res.status(200).json({
        success: true,
        message: result.message,
        order: result.order,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PurchaseOrderController();
