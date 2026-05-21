import { BaseRepository } from "../../shared/base/base.repository.js";
import { prisma } from "../../config/database.js";

class AuthRepository extends BaseRepository {
  constructor() {
    super(prisma.user);
  }

  // ─── Lookup ────────────────────────────────────────────────

  findByEmail(email) {
    return this.model.findUnique({ where: { email } });
  }

  findByPhone(phone) {
    return this.model.findUnique({ where: { phone } });
  }

  findByRefreshToken(token) {
    return this.model.findUnique({ where: { refreshToken: token } });
  }

  // ─── OTP ───────────────────────────────────────────────────

  findOtp(email) {
    return prisma.otpCode.findFirst({
      where: { email, used: false },
      orderBy: { createdAt: "desc" },
    });
  }

  createOtp(data) {
    return prisma.otpCode.create({ data });
  }

  markOtpUsed(id) {
    return prisma.otpCode.update({
      where: { id },
      data: { used: true },
    });
  }

  invalidatePreviousOtps(email) {
    return prisma.otpCode.updateMany({
      where: { email, used: false },
      data: { used: true },
    });
  }

  // ─── User mutations ────────────────────────────────────────

  /**
   * Upsert donneur après vérification OTP.
   * On matche sur l'email — si l'utilisateur existe déjà (re-login), on
   * met juste à jour le refresh token. Sinon on crée le compte.
   */
  // auth.repository.js
  upsertDonorAfterOtp({
    email,
    phone,
    firstName,
    lastName,
    bloodType,
    gender,
    dateOfBirth,
  }) {
    // ✅ Si phone est absent → c'est une reconnexion, l'user existe déjà
    // On fait juste un findUnique pour retourner l'user existant
    if (!phone) {
      return this.model.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          bloodType: true,
          gender: true,
          isActive: true,
          isAvailable: true,
          jambaarsProfile: {
            select: {
              totalPoints: true,
              currentGrade: true,
              donationCount: true,
            },
          },
        },
      });
    }

    // ✅ Si phone est présent → c'est une inscription, on upsert
    return this.model.upsert({
      where: { email },
      create: {
        email,
        phone,
        firstName,
        lastName,
        bloodType,
        gender,
        dateOfBirth,
        role: "DONOR",
        isActive: true,
        isAvailable: true,
        jambaarsProfile: {
          create: {
            totalPoints: 0,
            currentGrade: "ASPIRANT",
            donationCount: 0,
          },
        },
      },
      update: {
        ...(phone && { phone }),
        ...(bloodType && { bloodType }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        bloodType: true,
        gender: true,
        isActive: true,
        isAvailable: true,
        jambaarsProfile: {
          select: {
            totalPoints: true,
            currentGrade: true,
            donationCount: true,
          },
        },
      },
    });
  }

  /**
   * Crée la structure de santé + le directeur en une transaction atomique.
   * Le directeur est lié à la structure et marqué isStructureAdmin = true.
   */
  async createHealthStructureWithDirector(data) {
    return prisma.$transaction(async (tx) => {
      // 1. Création de la structure
      // On prend tout dans data SAUF ce qui concerne le directeur
      const {
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        ...structureData
      } = data;

      const structure = await tx.healthStructure.create({
        data: {
          name: structureData.structureName,
          registrationNumber: structureData.registrationNumber,
          address: structureData.address,
          region: structureData.region, // <-- ✅ La région est bien récupérée maintenant !
          phone: structureData.structurePhone,
          email: structureData.structureEmail,
          latitude: structureData.latitude,
          longitude: structureData.longitude,
          status: "PENDING_REVIEW",
          isVerified: false,
        },
      });

      // 2. Création du directeur
      const director = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          passwordHash,
          role: "HEALTH_STRUCTURE",
          isActive: true,
          healthStructureId: structure.id,
          isStructureAdmin: true,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isStructureAdmin: true,
          healthStructureId: true,
        },
      });

      return { structure, director };
    });
  }

  storeRefreshToken(userId, refreshToken, expiresAt) {
    return this.model.update({
      where: { id: userId },
      data: {
        refreshToken,
        refreshTokenExpiresAt: expiresAt,
      },
    });
  }

  revokeRefreshToken(userId) {
    return this.model.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      },
    });
  }

  findByRegistrationNumber(registrationNumber) {
    return this.prisma.healthStructure.findUnique({
      where: { registrationNumber },
    });
  }
}

export default new AuthRepository();
