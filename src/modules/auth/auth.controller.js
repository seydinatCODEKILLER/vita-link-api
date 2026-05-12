import authService from "./auth.service.js";

class AuthController {

  // POST /auth/register/donor
  async registerDonor(req, res, next) {
    try {
      const result = await authService.registerDonor(req.validated.body);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/register/health-structure
  async registerHealthStructure(req, res, next) {
    try {
      const result = await authService.registerHealthStructure(req.validated.body);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/otp/send
  async sendOtp(req, res, next) {
    try {
      const result = await authService.sendOtp(req.validated.body);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/otp/verify
  // Le front re-soumet les données du donneur ici pour l'upsert
  // (phone, bloodType, gender, etc.) — elles sont passées en body
  async verifyOtp(req, res, next) {
    try {
      const { email, code, ...donorData } = req.validated.body;
      const result = await authService.verifyOtp({ email, code, donorData });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/login
  async login(req, res, next) {
    try {
      const result = await authService.login(req.validated.body);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/refresh
  async refresh(req, res, next) {
    try {
      const result = await authService.refresh(req.validated.body);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/logout
  async logout(req, res, next) {
    try {
      // req.user est injecté par authenticate()
      const result = await authService.logout(req.user.id);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();