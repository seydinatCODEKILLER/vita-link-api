import notificationRepository from "./notification.repository.js";
import logger from "../../config/logger.js";
import { NotFoundError, ForbiddenError } from "../../shared/errors/AppError.js";

class NotificationService {
  
  // ── GET /notifications/me ───────────────────────────────────
  async getMyNotifications(userId, filters) {
    const { data, total } = await notificationRepository.findMyNotifications(userId, filters);

    return {
      notifications: data,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  // ── PATCH /notifications/:id/read ──────────────────────────
  async markAsRead(id, userId) {
    const notification = await notificationRepository.findById(id);
    
    if (!notification) {
      throw new NotFoundError("Notification");
    }

    // Sécurité : Un utilisateur ne peut marquer que SES propres notifications
    if (notification.userId !== userId) {
      throw new ForbiddenError("Vous n'êtes pas autorisé à modifier cette notification");
    }

    if (notification.isRead) {
      return notification; // Déjà lue, on ne refait pas d'update
    }

    const updated = await notificationRepository.markAsRead(id);

    logger.logEvent("NOTIFICATION_READ", {
      notificationId: id,
      userId,
    });

    return updated;
  }

  // ── DELETE /notifications/me ────────────────────────────────
  async deleteAllMyNotifications(userId) {
    const result = await notificationRepository.deleteAllByUserId(userId);

    logger.logEvent("NOTIFICATIONS_CLEARED", {
      userId,
      deletedCount: result.count,
    });

    return { deletedCount: result.count };
  }
}

export default new NotificationService();