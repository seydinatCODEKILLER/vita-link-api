import bloodRequestRepository from "./bloodRequest.repository.js";
import bloodStockRepository from "../blood-stocks/bloodStock.repository.js";
import alertService from "../alerts/alert.service.js";
import healthStructureRepository from "../health-structures/healthStructure.repository.js";
import { emitToStructure } from "../../config/socket.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

class BloodRequestService {
  // ── POST /blood-requests ─────────────────────────────────────
  async createRequest(data, user) {
    // 1. Récupérer l'hôpital avec sa CNTS affiliée
    const hospital = await healthStructureRepository.findById(
      user.healthStructureId,
    );

    if (!hospital) throw new NotFoundError("Structure introuvable");

    if (hospital.structureType === "CNTS") {
      throw new ForbiddenError(
        "Une CNTS ne peut pas faire de demande de sang — elle en gère le stock",
      );
    }

    if (!hospital.affiliatedCntsId) {
      throw new BadRequestError(
        "Votre structure n'est affiliée à aucune CNTS. Contactez l'administrateur.",
      );
    }

    // 2. Créer la demande — handledByCntsId résolu automatiquement
    const request = await bloodRequestRepository.create({
      requestingHospitalId: user.healthStructureId,
      requestedByUserId: user.id,
      handledByCntsId: hospital.affiliatedCntsId,
      bloodType: data.bloodType,
      quantityNeeded: data.quantityNeeded,
      urgencyLevel: data.urgencyLevel,
      serviceUnit: data.serviceUnit,
      clinicalContext: data.clinicalContext,
    });

    // Notifier la CNTS en temps réel
    emitToStructure(hospital.affiliatedCntsId, "blood_request:new", {
      requestId: request.id,
      bloodType: request.bloodType,
      quantityNeeded: request.quantityNeeded,
      urgencyLevel: request.urgencyLevel,
      hospitalName: hospital.name,
    });

    logger.logEvent("BLOOD_REQUEST_CREATED", {
      requestId: request.id,
      hospitalId: user.healthStructureId,
      cntsId: hospital.affiliatedCntsId,
    });

    return request;
  }

  // ── POST /blood-requests/:id/handle — Traitement par la CNTS ─
  async handleRequest(requestId, data, user) {
    const request = await bloodRequestRepository.findById(requestId);
    if (!request) throw new NotFoundError("Demande introuvable");

    if (request.handledByCnts?.id !== user.healthStructureId) {
      throw new ForbiddenError(
        "Vous ne pouvez traiter que les demandes adressées à votre CNTS",
      );
    }

    if (request.status !== "PENDING") {
      throw new BadRequestError(
        `Cette demande ne peut plus être traitée (statut : ${request.status})`,
      );
    }

    if (!user.employerStructure) {
      throw new BadRequestError(
        "Votre compte n'est rattaché à aucune structure. Contactez l'administrateur.",
      );
    }

    const stock = await bloodStockRepository.findByCntsAndType(
      user.healthStructureId,
      request.bloodType,
    );
    const available = stock?.quantity ?? 0;
    const syntheticUser = this._buildSyntheticUser(user);

    const handlers = {
      FULFILL: () => this._handleFulfill(request, data, user, stock, available),
      PARTIALLY_FULFILL: () =>
        this._handlePartialFulfill(
          requestId,
          request,
          data,
          user,
          stock,
          available,
          syntheticUser,
        ),
      ESCALATE: () =>
        this._handleEscalate(requestId, request, data, user, syntheticUser),
      REJECT: () => this._handleReject(requestId, request, data, user),
    };

    const handler = handlers[data.action];
    if (!handler) {
      throw new BadRequestError(`Action invalide : ${data.action}`);
    }

    return handler();
  }

  // ── GET /blood-requests — Liste selon le rôle ────────────────
  async getRequests(user, filters) {
    if (user.employerStructure?.structureType === "CNTS") {
      const { data, total } = await bloodRequestRepository.findByCnts(
        user.healthStructureId,
        filters,
      );
      return { requests: data, pagination: this._pagination(total, filters) };
    }

    const { data, total } = await bloodRequestRepository.findByHospital(
      user.healthStructureId,
      filters,
    );
    return { requests: data, pagination: this._pagination(total, filters) };
  }

  // ── GET /blood-requests/:id ───────────────────────────────────
  async getById(requestId, user) {
    const request = await bloodRequestRepository.findById(requestId);
    if (!request) throw new NotFoundError("Demande introuvable");

    // Un hôpital ne voit que ses propres demandes
    // Une CNTS ne voit que les demandes qui lui sont adressées
    const isOwner =
      request.requestingHospital?.id === user.healthStructureId ||
      request.handledByCnts?.id === user.healthStructureId;

    if (user.role !== "ADMIN" && !isOwner) {
      throw new ForbiddenError("Accès refusé à cette demande");
    }

    return request;
  }

  // ── PATCH /blood-requests/:id/cancel ─────────────────────────
  async cancelRequest(requestId, user) {
    const request = await bloodRequestRepository.findById(requestId);
    if (!request) throw new NotFoundError("Demande introuvable");

    // Seul l'hôpital demandeur peut annuler
    if (request.requestingHospital?.id !== user.healthStructureId) {
      throw new ForbiddenError("Seul l'hôpital demandeur peut annuler");
    }

    if (!["PENDING"].includes(request.status)) {
      throw new BadRequestError(
        "Seules les demandes en attente peuvent être annulées",
      );
    }

    return bloodRequestRepository.updateStatus(requestId, {
      status: "CANCELLED",
    });
  }

  // ── Helpers privés ────────────────────────────────────────────

  _buildSyntheticUser(user) {
    return {
      ...user,
      employerStructure: {
        ...user.employerStructure,
        structureType: "CNTS",
      },
    };
  }

  async _handleFulfill(request, data, user, stock, available) {
    const { cntsNotes } = data;

    if (available < request.quantityNeeded) {
      throw new BadRequestError(
        `Stock insuffisant pour fournir toute la demande (Dispo: ${available})`,
      );
    }

    await bloodStockRepository.decrement(stock.id, request.quantityNeeded);

    const fulfilled = await bloodRequestRepository.updateStatus(request.id, {
      status: "FULFILLED",
      quantityProvided: request.quantityNeeded,
      handledByUserId: user.id,
      cntsNotes: cntsNotes ?? null,
      fulfilledAt: new Date(),
    });

    emitToStructure(request.requestingHospital.id, "blood_request:fulfilled", {
      requestId: request.id,
      quantityProvided: request.quantityNeeded,
    });

    logger.logEvent("BLOOD_REQUEST_FULFILLED", {
      requestId: request.id,
      cntsAgentId: user.id,
    });

    return fulfilled;
  }

  async _handlePartialFulfill(
    requestId,
    request,
    data,
    user,
    stock,
    available,
    syntheticUser,
  ) {
    const { quantityProvided, cntsNotes, radiusKm } = data;

    if (!quantityProvided || quantityProvided <= 0) {
      throw new BadRequestError(
        "quantityProvided doit être supérieur à 0. Utilisez ESCALATE si vous n'avez aucun stock.",
      );
    }

    if (available < quantityProvided) {
      throw new BadRequestError(
        `Stock insuffisant pour fournir ${quantityProvided} poches (Dispo: ${available})`,
      );
    }

    await bloodStockRepository.decrement(stock.id, quantityProvided);

    const { alert } = await alertService.createAlert(
      {
        bloodType: request.bloodType,
        quantityNeeded: request.quantityNeeded - quantityProvided,
        urgencyLevel: request.urgencyLevel,
        serviceUnit: request.serviceUnit,
        origin: "CNTS_ESCALATION",
        bloodRequestId: requestId,
        radiusKm: radiusKm ?? 10,
      },
      syntheticUser,
    );

    const partial = await bloodRequestRepository.updateStatus(requestId, {
      status: "PARTIALLY_FULFILLED",
      quantityProvided,
      handledByUserId: user.id,
      cntsNotes: cntsNotes ?? null,
      escalatedAlertId: alert.id,
    });

    emitToStructure(request.requestingHospital.id, "blood_request:partial", {
      requestId,
      quantityProvided,
      alertId: alert.id,
    });

    logger.logEvent("BLOOD_REQUEST_PARTIAL", {
      requestId,
      quantityProvided,
      alertId: alert.id,
    });

    return partial;
  }

  async _handleEscalate(requestId, request, data, user, syntheticUser) {
    const { cntsNotes, radiusKm } = data;

    const { alert } = await alertService.createAlert(
      {
        bloodType: request.bloodType,
        quantityNeeded: request.quantityNeeded,
        urgencyLevel: request.urgencyLevel,
        serviceUnit: request.serviceUnit,
        origin: "CNTS_ESCALATION",
        bloodRequestId: requestId,
        radiusKm: radiusKm ?? 10,
      },
      syntheticUser,
    );

    const escalated = await bloodRequestRepository.updateStatus(requestId, {
      status: "ESCALATED_TO_ALERT",
      handledByUserId: user.id,
      cntsNotes: cntsNotes ?? null,
      escalatedAlertId: alert.id,
    });

    emitToStructure(request.requestingHospital.id, "blood_request:escalated", {
      requestId,
      alertId: alert.id,
    });

    logger.logEvent("BLOOD_REQUEST_ESCALATED", {
      requestId,
      alertId: alert.id,
    });

    return escalated;
  }

  async _handleReject(requestId, request, data, user) {
    const { cntsNotes } = data;

    const rejected = await bloodRequestRepository.updateStatus(requestId, {
      status: "REJECTED",
      handledByUserId: user.id,
      cntsNotes: cntsNotes ?? null,
    });

    emitToStructure(request.requestingHospital.id, "blood_request:rejected", {
      requestId,
    });

    logger.logEvent("BLOOD_REQUEST_REJECTED", {
      requestId,
      cntsAgentId: user.id,
    });

    return rejected;
  }

  _pagination(total, { page, limit }) {
    return { total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export default new BloodRequestService();
