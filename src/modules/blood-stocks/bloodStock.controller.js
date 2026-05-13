import bloodStockService from "./bloodStock.service.js";

class BloodStockController {

  // GET /blood-stocks/me
  async getMyStocks(req, res, next) {
    try {
      const stocks = await bloodStockService.getMyStocks(req.user);
      res.status(200).json({ success: true, stocks });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /blood-stocks/me
  async updateMyStock(req, res, next) {
    try {
      const stock = await bloodStockService.updateMyStock(
        req.user,
        req.validated.body
      );
      res.status(200).json({ success: true, stock });
    } catch (err) {
      next(err);
    }
  }

  // GET /blood-stocks
  async getAllStocks(req, res, next) {
    try {
      const result = await bloodStockService.getAllStocks(req.validated.query);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export default new BloodStockController();