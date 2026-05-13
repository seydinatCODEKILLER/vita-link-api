import partnerService from "./partner.service.js";

class PartnerController {
  // GET /partners
  async listPartners(req, res, next) {
    try {
      // Si Admin, on renvoie tout. Sinon, seulement les actifs.
      const result =
        req.user.role === "ADMIN"
          ? await partnerService.listAllPartners()
          : await partnerService.listActivePartners();

      res.status(200).json({ success: true, partners: result });
    } catch (err) {
      next(err);
    }
  }

  // GET /partners/:id
  async getPartnerById(req, res, next) {
    try {
      const partner = await partnerService.getPartnerById(
        req.params.id,
        req.user.role,
      );
      res.status(200).json({ success: true, partner });
    } catch (err) {
      next(err);
    }
  }

  // POST /partners
  async createPartner(req, res, next) {
    try {
      const partner = await partnerService.createPartner(
        req.validated.body,
        req.user.id,
      );
      res.status(201).json({ success: true, partner });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /partners/:id
  async updatePartner(req, res, next) {
    try {
      const partner = await partnerService.updatePartner(
        req.validated.params.id,
        req.validated.body,
      );
      res.status(200).json({ success: true, partner });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /partners/:id
  async deactivatePartner(req, res, next) {
    try {
      const partner = await partnerService.deactivatePartner(
        req.validated.params.id,
      );
      res.status(200).json({ success: true, partner });
    } catch (err) {
      next(err);
    }
  }
}

export default new PartnerController();
