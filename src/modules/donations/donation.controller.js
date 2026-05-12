import donationService from "./donation.service.js";

class DonationController {

  // POST /donations/scan
  async scan(req, res, next) {
    try {
      const result = await donationService.scanAndValidate(
        req.validated.body,
        req.user
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /donations/me
  async getMyDonations(req, res, next) {
    try {
      const result = await donationService.getMyDonations(
        req.user.id,
        req.validated.query
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // GET /donations/:id
  async getDonationById(req, res, next) {
    try {
      const donation = await donationService.getDonationById(
        req.params.id,
        req.user
      );
      res.status(200).json({ success: true, donation });
    } catch (err) {
      next(err);
    }
  }

  // GET /donations/structure
  async getStructureDonations(req, res, next) {
    try {
      const result = await donationService.getStructureDonations(
        req.user,
        req.validated.query
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export default new DonationController();