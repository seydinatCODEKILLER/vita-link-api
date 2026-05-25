import donationDayService from "./donationDays.service.js";

class DonationDayController {
  // ── STRUCTURES DE SANTÉ ────────────────────────────────────

  async getMyStructureDays(req, res, next) {
    try {
      const result = await donationDayService.getMyStructureDays(
        req.user,
        req.user.healthStructureId,
        req.validated.query,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getDayDetail(req, res, next) {
    try {
      const result = await donationDayService.getDayDetail(
        req.user,
        req.validated.params.id,
        req.user.role,
      );
      res.status(200).json({ success: true, day: result });
    } catch (err) {
      next(err);
    }
  }

  async createDay(req, res, next) {
    try {
      const result = await donationDayService.createDay(
        req.user,
        req.user.healthStructureId,
        req.validated.body,
        req.file,
      );
      res.status(201).json({ success: true, day: result });
    } catch (err) {
      next(err);
    }
  }

  async updateDay(req, res, next) {
    try {
      const result = await donationDayService.updateDay(
        req.user,
        req.validated.params.id,
        req.validated.body,
        req.file,
      );
      res.status(200).json({ success: true, day: result });
    } catch (err) {
      next(err);
    }
  }

  async cancelDay(req, res, next) {
    try {
      const result = await donationDayService.cancelDay(
        req.user,
        req.validated.params.id,
        req.validated.body.cancelReason,
      );
      res.status(200).json({ success: true, day: result });
    } catch (err) {
      next(err);
    }
  }

  async getRegistrations(req, res, next) {
    try {
      const result = await donationDayService.getRegistrations(
        req.user,
        req.validated.params.id,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async markAttendance(req, res, next) {
    try {
      const { status } = req.validated.body;
      const result = await donationDayService.markAttendance(
        req.user,
        req.validated.params.registrationId,
        status,
      );
      res.status(200).json({ success: true, registration: result });
    } catch (err) {
      next(err);
    }
  }

  // ── DONNEURS ───────────────────────────────────────────────

  async getPublishedDays(req, res, next) {
    try {
      const result = await donationDayService.getPublishedDays(
        req.user,
        req.validated.query,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getMyRegistrations(req, res, next) {
    try {
      const result = await donationDayService.getMyRegistrations(
        req.user.id,
        req.validated.query,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async registerDonor(req, res, next) {
    try {
      const result = await donationDayService.registerDonor(
        req.user.id,
        req.validated.params.id,
      );
      res.status(201).json({ success: true, registration: result });
    } catch (err) {
      next(err);
    }
  }

  async cancelDonorRegistration(req, res, next) {
    try {
      const result = await donationDayService.cancelDonorRegistration(
        req.user.id,
        req.validated.params.id,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // ── ADMIN ──────────────────────────────────────────────────

  async adminGetAllDays(req, res, next) {
    try {
      const result = await donationDayService.getAllDays(req.validated.query);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async adminSuspendDay(req, res, next) {
    try {
      const result = await donationDayService.suspendDay(
        req.validated.params.id,
      );
      res.status(200).json({ success: true, day: result });
    } catch (err) {
      next(err);
    }
  }
}

export default new DonationDayController();
