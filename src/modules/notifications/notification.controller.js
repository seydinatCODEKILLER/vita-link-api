import notificationService from "./notification.service.js";

class NotificationController {
  // GET /notifications/me
  async getMyNotifications(req, res, next) {
    try {
      const result = await notificationService.getMyNotifications(
        req.user.id,
        req.validated.query,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /notifications/:id/read
  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markAsRead(
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({ success: true, notification });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /notifications/me
  async deleteAllMyNotifications(req, res, next) {
    try {
      const result = await notificationService.deleteAllMyNotifications(
        req.user.id,
      );
      res.status(200).json({
        success: true,
        message: "Toutes vos notifications ont été supprimées",
        deletedCount: result.deletedCount,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new NotificationController();
