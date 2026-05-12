import userService from "./user.service.js";

class UserController {

  // GET /me
  async getMe(req, res, next) {
    try {
      const user = await userService.getMe(req.user.id);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /me
  async updateProfile(req, res, next) {
    try {
      const user = await userService.updateProfile(req.user.id, req.validated.body);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /me/avatar
  async updateAvatar(req, res, next) {
    try {
      const user = await userService.updateAvatar(req.user.id, req.file);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /me/location
  async updateLocation(req, res, next) {
    try {
      const user = await userService.updateLocation(req.user.id, req.validated.body);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /me/availability
  async updateAvailability(req, res, next) {
    try {
      const user = await userService.updateAvailability(
        req.user.id,
        req.validated.body,
        req.user.role
      );
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /me/expo-token
  async updateExpoToken(req, res, next) {
    try {
      const user = await userService.updateExpoToken(req.user.id, req.validated.body);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /me
  async deleteMe(req, res, next) {
    try {
      const result = await userService.deleteMe(req.user.id, req.user.role);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();