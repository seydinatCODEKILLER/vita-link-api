import purchaseOrderRepository from "./purchaseOrder.repository.js";
import { generateDonationCode } from "../../shared/utils/qrGenerator.utils.js";
import { emitToStructure } from "../../config/socket.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

// Expiration : 24h pour récupérer le sang
const PURCHASE_ORDER_EXPIRY_HOURS = 24;

class PurchaseOrderService {
  // ── Création interne — appelée depuis bloodRequest.service.js ─
  async createForRequest({
    bloodRequestId,
    cntsId,
    hospitalId,
    bloodType,
    quantity,
  }) {
    const code = generateDonationCode().replace("VITA-", "CMD-");

    const expiresAt = new Date(
      Date.now() + PURCHASE_ORDER_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const order = await purchaseOrderRepository.create({
      code,
      bloodRequestId,
      cntsId,
      hospitalId,
      bloodType,
      quantity,
      expiresAt,
    });

    // Notifier l'hôpital qu'un bon est disponible
    emitToStructure(hospitalId, "purchase_order:created", {
      orderId: order.id,
      code: order.code,
      bloodType: order.bloodType,
      quantity: order.quantity,
      expiresAt: order.expiresAt,
    });

    logger.logEvent("PURCHASE_ORDER_CREATED", {
      orderId: order.id,
      bloodRequestId,
      cntsId,
      hospitalId,
    });

    return order;
  }

  // ── GET /purchase-orders/:bloodRequestId — Hôpital récupère son bon ─
  async getByBloodRequest(bloodRequestId, user) {
    const order =
      await purchaseOrderRepository.findByBloodRequest(bloodRequestId);
    if (!order) throw new NotFoundError("Bon de commande introuvable");

    // Seul l'hôpital concerné peut voir son bon
    if (user.role !== "ADMIN" && order.hospital.id !== user.healthStructureId) {
      throw new ForbiddenError("Accès refusé à ce bon de commande");
    }

    return order;
  }

  // ── POST /purchase-orders/:code/scan — CNTS scanne et valide ─
  async scan(code, user) {
    const order = await purchaseOrderRepository.findByCode(code);
    if (!order) throw new NotFoundError("Bon de commande introuvable");

    // Seule la CNTS qui a émis le bon peut le scanner
    if (order.cnts.id !== user.healthStructureId) {
      throw new ForbiddenError(
        "Ce bon de commande n'appartient pas à votre CNTS",
      );
    }

    if (order.status === "USED") {
      throw new BadRequestError("Ce bon de commande a déjà été utilisé");
    }

    if (order.status === "EXPIRED") {
      throw new BadRequestError(
        "Ce bon de commande a expiré. Contactez l'hôpital pour en générer un nouveau.",
      );
    }

    if (order.status === "CANCELLED") {
      throw new BadRequestError("Ce bon de commande a été annulé");
    }

    if (new Date() > new Date(order.expiresAt)) {
      throw new BadRequestError("Ce bon de commande a expiré");
    }

    const validated = await purchaseOrderRepository.markAsUsed(
      order.id,
      user.id,
    );

    // Notifier l'hôpital que le sang a été récupéré
    emitToStructure(order.hospital.id, "purchase_order:validated", {
      orderId: order.id,
      code: order.code,
      scannedAt: validated.scannedAt,
      bloodType: order.bloodType,
      quantity: order.quantity,
    });

    logger.logEvent("PURCHASE_ORDER_SCANNED", {
      orderId: order.id,
      scannedBy: user.id,
      cntsId: user.healthStructureId,
      hospitalId: order.hospital.id,
    });

    return {
      message: "Bon de commande validé. La remise du sang est confirmée.",
      order: validated,
    };
  }

  async confirmExpiry(id, { wasDelivered, cntsNotes }, user) {
    const order = await purchaseOrderRepository.findById(id);

    if (!order) throw new NotFoundError("Bon de commande introuvable");

    // Sécurité : Seule la CNTS concernée peut confirmer
    if (order.cnts.id !== user.healthStructureId) {
      throw new ForbiddenError("Vous n'êtes pas autorisé à confirmer ce bon.");
    }

    // Sécurité : On ne peut confirmer qu'un bon EXPIRED
    if (order.status !== "EXPIRED") {
      throw new BadRequestError(
        "Seuls les bons expirés nécessitent une confirmation manuelle.",
      );
    }

    // Exécuter la transaction
    const confirmedOrder = await purchaseOrderRepository.confirmExpiry(
      id,
      wasDelivered,
      cntsNotes,
      user.id,
    );

    // Notifier l'hôpital du résultat
    if (wasDelivered) {
      emitToStructure(confirmedOrder.hospital.id, "purchase_order:validated", {
        orderId: confirmedOrder.id,
        code: confirmedOrder.code,
        scannedAt: confirmedOrder.scannedAt,
        bloodType: confirmedOrder.bloodType,
        quantity: confirmedOrder.quantity,
      });
      logger.logEvent("PURCHASE_ORDER_CONFIRMED_DELIVERED", { orderId: id });
    } else {
      emitToStructure(
        confirmedOrder.hospital.id,
        "purchase_order:cancelled_stock_restored",
        {
          orderId: confirmedOrder.id,
          code: confirmedOrder.code,
          bloodType: confirmedOrder.bloodType,
          quantity: confirmedOrder.quantity,
          message:
            "Le bon a expiré et le sang n'a pas été retiré. Veuillez reformuler votre demande si nécessaire.",
        },
      );
      logger.logEvent("PURCHASE_ORDER_CONFIRMED_NOT_DELIVERED_STOCK_RESTORED", {
        orderId: id,
      });
    }

    return {
      message: wasDelivered
        ? "Bon confirmé comme remis. Le statut est passé à USED."
        : "Bon confirmé comme non remis. Le stock CNTS a été recrédité.",
      order: confirmedOrder,
    };
  }

  // ── GET /purchase-orders — Liste selon le rôle ───────────────
  async getList(user, filters) {
    if (user.employerStructure?.structureType === "CNTS") {
      const { data, total } = await purchaseOrderRepository.findByCnts(
        user.healthStructureId,
        filters,
      );
      return { orders: data, pagination: this._pagination(total, filters) };
    }

    const { data, total } = await purchaseOrderRepository.findByHospital(
      user.healthStructureId,
      filters,
    );
    return { orders: data, pagination: this._pagination(total, filters) };
  }

  _pagination(total, { page, limit }) {
    return { total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export default new PurchaseOrderService();
