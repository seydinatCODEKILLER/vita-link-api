import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Selects partagés ─────────────────────────────────────────

export const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  channel: true,
  payload: true,
  status: true,
  isRead: true,
  sentAt: true,
  createdAt: true,
  alert: {
    select: { id: true, bloodType: true, urgencyLevel: true },
  },
};

// ─── Repository ───────────────────────────────────────────────

class NotificationRepository extends BaseRepository {
  constructor() {
    super(prisma.notification);
  }

  // ─── Lecture ───────────────────────────────────────────────

  findMyNotifications(userId, { page, limit, isRead }) {
    const where = {
      userId,
      ...(isRead !== undefined && { isRead: isRead === "true" }),
    };

    return this.findManyWithCount(where, {
      page,
      limit,
      sort: { createdAt: "desc" },
      select: NOTIFICATION_SELECT,
    });
  }

  findById(id) {
    return this.model.findUnique({
      where: { id },
      select: { ...NOTIFICATION_SELECT, userId: true }, // userId nécessaire pour l'autorisation
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  markAsRead(id) {
    return this.model.update({
      where: { id },
      data: { isRead: true },
      select: NOTIFICATION_SELECT,
    });
  }

  deleteAllByUserId(userId) {
    return this.model.deleteMany({
      where: { userId },
    });
  }
}

export default new NotificationRepository();