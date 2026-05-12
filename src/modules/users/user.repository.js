import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

// ─── Select partagé ───────────────────────────────────────────
export const ME_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  gender: true,
  dateOfBirth: true,
  avatarUrl: true,
  bloodType: true,
  isAvailable: true,
  isActive: true,
  latitude: true,
  longitude: true,
  healthStructureId: true,
  isStructureAdmin: true,
  createdAt: true,
  jambaarsProfile: {
    select: {
      totalPoints: true,
      currentGrade: true,
      donationCount: true,
      livesSavedEstimate: true,
      lastDonationAt: true,
      nextEligibilityAt: true,
      city: true,
      district: true,
    },
  },
  employerStructure: {
    select: {
      id: true,
      name: true,
      status: true,
      isVerified: true,
      address: true,
    },
  },
};

class UserRepository extends BaseRepository {
  constructor() {
    super(prisma.user);
  }

  // ─── Lecture ───────────────────────────────────────────────

  findMe(userId) {
    return this.model.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
  }

  // ─── Mutations profil ──────────────────────────────────────

  updateProfile(userId, data) {
    return this.model.update({
      where: { id: userId },
      data,
      select: ME_SELECT,
    });
  }

  updateAvatar(userId, avatarUrl) {
    return this.model.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });
  }

  updateLocation(userId, latitude, longitude) {
    return this.model.update({
      where: { id: userId },
      data: { latitude, longitude },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  updateAvailability(userId, isAvailable) {
    return this.model.update({
      where: { id: userId },
      data: { isAvailable },
      select: {
        id: true,
        isAvailable: true,
      },
    });
  }

  updateExpoToken(userId, expoPushToken) {
    return this.model.update({
      where: { id: userId },
      data: { expoPushToken },
      select: {
        id: true,
        expoPushToken: true,
      },
    });
  }

  // ─── Suppression ───────────────────────────────────────────

  softDelete(userId) {
    return this.model.update({
      where: { id: userId },
      data: {
        email: null,
        phone: `DELETED_${userId}`,
        firstName: "Compte",
        lastName: "Supprimé",
        avatarUrl: null,
        dateOfBirth: null,
        isActive: false,
        isAvailable: false,
        expoPushToken: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        latitude: null,
        longitude: null,
      },
      select: { id: true },
    });
  }
}

export default new UserRepository();
