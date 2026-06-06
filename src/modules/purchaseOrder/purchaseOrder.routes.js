import { Router } from "express";
import purchaseOrderController from "./purchaseOrder.controller.js";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import {
  requireRole,
  requireStructureMember,
  requireCntsRole,
  requireHospitalRole,
} from "../../shared/middlewares/role.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { crudLimiter } from "../../config/rateLimiter.js";
import {
  ScanPurchaseOrderSchema,
  GetPurchaseOrderSchema,
  ListPurchaseOrdersSchema,
  ConfirmExpirySchema,
} from "./purchaseOrder.schema.js";

const router = Router();
router.use(authenticate);

// ⚠️ Route statique avant les routes dynamiques

router.post(
  "/:id/expire-confirm",
  requireCntsRole,
  requireStructureMember,
  crudLimiter,
  validate(ConfirmExpirySchema),
  purchaseOrderController.confirmExpiry.bind(purchaseOrderController),
);

// CNTS scanne le QR Code de l'ambulancier
router.post(
  "/:code/scan",
  requireCntsRole,
  requireStructureMember,
  crudLimiter,
  validate(ScanPurchaseOrderSchema),
  purchaseOrderController.scan.bind(purchaseOrderController),
);

// Liste des bons (hôpital voit les siens, CNTS voit les siens)
router.get(
  "/",
  requireRole("CNTS_AGENT", "CNTS_ADMIN", "HOSPITAL_AGENT", "ADMIN"),
  requireStructureMember,
  crudLimiter,
  validate(ListPurchaseOrdersSchema),
  purchaseOrderController.getList.bind(purchaseOrderController),
);

// Hôpital récupère son bon via l'ID de la demande
router.get(
  "/:bloodRequestId",
  requireHospitalRole,
  requireStructureMember,
  crudLimiter,
  validate(GetPurchaseOrderSchema),
  purchaseOrderController.getByBloodRequest.bind(purchaseOrderController),
);

export default router;
