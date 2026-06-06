import { prisma } from "../config/database.js";
import logger from "../config/logger.js";
import { emitToStructure } from "../config/socket.js";

export const runPurchaseOrderExpiryJob = async () => {
  try {
    const now = new Date();

    // Trouver tous les bons PENDING dont la date d'expiration est dépassée
    const expiredOrders = await prisma.purchaseOrder.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        code: true,
        cntsId: true,
        hospitalId: true,
        bloodType: true,
        quantity: true,
      },
    });

    if (expiredOrders.length === 0) return;

    // Passer tous ces bons en EXPIRED
    const result = await prisma.purchaseOrder.updateMany({
      where: {
        id: { in: expiredOrders.map((o) => o.id) },
      },
      data: { status: "EXPIRED" },
    });

    // Notifier la CNTS pour chaque bon expiré (pour qu'ils confirment manuellement)
    for (const order of expiredOrders) {
      emitToStructure(order.cntsId, "purchase_order:expired_confirm_required", {
        orderId: order.id,
        code: order.code,
        bloodType: order.bloodType,
        quantity: order.quantity,
        hospitalId: order.hospitalId,
        message: `Le bon ${order.code} a expiré. Veuillez confirmer si le sang a été remis.`,
      });
    }

    logger.logEvent("CRON_PURCHASE_ORDERS_EXPIRED", {
      count: result.count,
    });
  } catch (err) {
    logger.error({ err }, "Erreur CRON purchaseOrderExpiry");
  }
};
