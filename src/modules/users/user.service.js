import userRepository from "./user.repository.js";
import MediaUploader from "../../shared/utils/uploader.utils.js";
import logger from "../../config/logger.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

class UserService {
  // ── GET /me ─────────────────────────────────────────────────
  async getMe(userId) {
    const user = await userRepository.findMe(userId);
    if (!user) throw new NotFoundError("Utilisateur");
    return user;
  }

  // ── PATCH /me — infos générales ─────────────────────────────
  async updateProfile(userId, data) {
    const user = await userRepository.updateProfile(userId, data);
    if (!user) throw new NotFoundError("Utilisateur");

    logger.logEvent("PROFILE_UPDATED", { userId });
    return user;
  }

  // ── PATCH /me/avatar ─────────────────────────────────────────
  async updateAvatar(userId, file) {
    if (!file) throw new BadRequestError("Aucune image fournie");

    const currentUser = await userRepository.findMe(userId);

    const uploader = new MediaUploader();
    let uploadResult;

    try {
      uploadResult = await uploader.upload(
        file,
        "vita-link/avatars",
        `avatar_${userId}`,
      );
    } catch {
      throw new BadRequestError("Échec de l'upload de l'image");
    }

    if (currentUser?.avatarUrl) {
      await uploader.deleteByUrl(currentUser.avatarUrl);
    }

    const user = await userRepository.updateAvatar(userId, uploadResult.url);

    logger.logEvent("AVATAR_UPDATED", { userId, url: uploadResult.url });
    return user;
  }

  // ── PATCH /me/location ────────────────────────────────────────
  async updateLocation(userId, { latitude, longitude }) {
    const updated = await userRepository.updateLocation(
      userId,
      latitude,
      longitude,
    );

    logger.logEvent("LOCATION_UPDATED", { userId, latitude, longitude });
    return updated;
  }

  // ── PATCH /me/availability ────────────────────────────────────
  async updateAvailability(userId, { isAvailable }, userRole) {
    if (userRole !== "DONOR") {
      throw new ForbiddenError("La disponibilité est réservée aux donneurs");
    }

    const updated = await userRepository.updateAvailability(
      userId,
      isAvailable,
    );

    logger.logEvent("AVAILABILITY_UPDATED", { userId, isAvailable });
    return updated;
  }

  // ── PATCH /me/expo-token ──────────────────────────────────────
  async updateExpoToken(userId, { expoPushToken }) {
    const updated = await userRepository.updateExpoToken(userId, expoPushToken);

    logger.logEvent("EXPO_TOKEN_UPDATED", { userId });
    return updated;
  }

  // ── DELETE /me ────────────────────────────────────────────────
  async deleteMe(userId, userRole) {
    if (userRole === "ADMIN") {
      throw new ForbiddenError(
        "Les administrateurs ne peuvent pas supprimer leur compte via cette route",
      );
    }

    await userRepository.softDelete(userId);

    logger.logEvent("ACCOUNT_DELETED", { userId, role: userRole });
    return {
      message: "Votre compte a été supprimé. Vos données ont été anonymisées.",
    };
  }
}

export default new UserService();
