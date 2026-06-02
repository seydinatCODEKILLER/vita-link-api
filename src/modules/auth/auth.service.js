import TokenGenerator from "../../config/jwt.js";
import { sendEmail } from "../../config/mailer.js";
import { env } from "../../config/env.js";
import logger from "../../config/logger.js";

import authRepository from "./auth.repository.js";
import {
  hashPassword,
  comparePassword,
} from "../../shared/utils/hasher.utils.js";
import {
  generateOtpCode,
  getOtpExpiry,
  isOtpValid,
} from "../../shared/utils/otp.utils.js";

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";
import { otpEmailHtml } from "../../shared/templates/otpEmail.template.js";

const tokenGenerator = new TokenGenerator();

// ─── Helpers ─────────────────────────────────────────────────

const buildTokenPair = (userId, role) => {
  const payload = { id: userId, role };
  const accessToken = tokenGenerator.sign(payload);
  const refreshToken = tokenGenerator.signRefresh(payload);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30j
  return { accessToken, refreshToken, expiresAt };
};

// ─── Service ──────────────────────────────────────────────────

class AuthService {
  // ── 1. Pré-inscription donneur ──────────────────────────────
  async registerDonor(data) {
    const { email, phone } = data;

    const existingPhone = await authRepository.findByPhone(phone);
    if (existingPhone) {
      throw new ConflictError("Ce numéro de téléphone est déjà utilisé");
    }

    if (email) {
      const existingEmail = await authRepository.findByEmail(email);
      if (existingEmail) {
        throw new ConflictError("Cette adresse email est déjà utilisée");
      }
    }

    if (!email) {
      return {
        message:
          "Numéro disponible. Fournissez votre email pour recevoir le code de vérification.",
        requiresEmail: true,
        phone,
      };
    }

    // ✅ Créer le compte maintenant, pas au moment du verify
    await authRepository.createDonor(data);

    await authRepository.invalidatePreviousOtps(email);
    const code = generateOtpCode();
    const expiry = getOtpExpiry(10);
    await authRepository.createOtp({ email, code, expiresAt: expiry });

    await sendEmail({
      to: email,
      toName: data.firstName,
      subject: "🩸 Vita-Link — Votre code de vérification",
      html: otpEmailHtml(data.firstName, code),
    });

    logger.logEvent("OTP_SENT", { email, context: "donor_register" });

    return {
      message:
        "Compte créé. Code de vérification envoyé à votre adresse email.",
      email,
    };
  }

  // ── Vérification OTP — plus de donorData ─────────────────────
  async verifyOtp({ email, code }) {
    const otpRecord = await authRepository.findOtp(email);

    if (!isOtpValid(otpRecord)) {
      throw new BadRequestError("Code OTP invalide ou expiré");
    }
    if (otpRecord.code !== code) {
      throw new BadRequestError("Code OTP incorrect");
    }

    await authRepository.markOtpUsed(otpRecord.id);

    // ✅ Le user existe déjà — simple lookup
    const user = await authRepository.findDonorByEmail(email);
    if (!user) {
      throw new NotFoundError(
        "Aucun compte trouvé pour cet email. Veuillez vous inscrire d'abord.",
      );
    }

    const { accessToken, refreshToken, expiresAt } = buildTokenPair(
      user.id,
      user.role,
    );
    await authRepository.storeRefreshToken(user.id, refreshToken, expiresAt);

    logger.logEvent("OTP_VERIFIED", { userId: user.id, email });

    return {
      message: "Vérification réussie. Bienvenue dans la communauté Jambaar !",
      accessToken,
      refreshToken,
      user,
    };
  }
  // ── 2. Inscription structure de santé ───────────────────────
  async registerHealthStructure(data) {
    const { email, phone, registrationNumber } = data;

    // Vérifications unicité
    const [existingEmail, existingPhone, existingReg] = await Promise.all([
      authRepository.findByEmail(email),
      authRepository.findByPhone(phone),
      authRepository.findByRegistrationNumber(registrationNumber),
    ]);

    if (existingEmail)
      throw new ConflictError("Cette adresse email est déjà utilisée");
    if (existingPhone)
      throw new ConflictError("Ce numéro de téléphone est déjà utilisé");

    if (existingReg)
      throw new ConflictError("Ce numéro d'enregistrement est déjà utilisé");

    const passwordHash = await hashPassword(data.password);

    // ✅ On passe directement data et passwordHash
    const { structure, director } =
      await authRepository.createHealthStructureWithDirector({
        ...data,
        passwordHash,
      });

    logger.logEvent("HEALTH_STRUCTURE_REGISTERED", {
      structureId: structure.id,
      directorId: director.id,
      status: "PENDING_REVIEW",
    });

    return {
      message:
        "Inscription soumise avec succès. Votre structure est en attente de vérification par notre équipe.",
      director,
      structure: {
        id: structure.id,
        name: structure.name,
        region: structure.region,
        status: structure.status,
      },
    };
  }

  // ── 3. Envoi OTP standalone (re-send) ───────────────────────
  async sendOtp({ email }) {
    // 1. Chercher l'utilisateur par email
    const existingUser = await authRepository.findByEmailWithRole(email);

    // 2. Si l'utilisateur n'existe pas, on lève une erreur
    if (!existingUser) {
      throw new NotFoundError(
        "Aucun compte trouvé pour cet email. Veuillez vous inscrire d'abord.",
      );
    }

    // 3. Si l'utilisateur existe mais n'a PAS le rôle DONNEUR, on lève une erreur
    // (Les structures de santé se connectent via mot de passe, pas via OTP)
    if (existingUser.role !== "DONOR") {
      throw new ForbiddenError(
        "Les comptes structures de santé ne peuvent pas se connecter via code OTP. Veuillez utiliser la connexion avec mot de passe.",
      );
    }

    // 4. Sécurité supplémentaire : si le compte est suspendu
    if (!existingUser.isActive) {
      throw new ForbiddenError(
        "Votre compte a été suspendu. Contactez le support.",
      );
    }

    // ── Si on arrive ici, c'est un donneur actif → On envoie l'OTP ──

    await authRepository.invalidatePreviousOtps(email);

    const code = generateOtpCode();
    const expiry = getOtpExpiry(10);

    await authRepository.createOtp({ email, code, expiresAt: expiry });

    // ✅ AMÉLIORATION : On utilise le vrai prénom du donneur dans l'email
    await sendEmail({
      to: email,
      subject: "🩸 Vita-Link — Votre code de connexion sécurisé",
      html: otpEmailHtml(existingUser.firstName || "Jambaar", code),
    });

    logger.logEvent("OTP_SENT", { email, context: "reconnect_donor" });

    return { message: "Code de vérification envoyé à votre adresse email." };
  }

  // ── 4. Vérification OTP → Upsert User → JWT ─────────────────
  async verifyOtp({ email, code, donorData }) {
    const otpRecord = await authRepository.findOtp(email);

    if (!isOtpValid(otpRecord)) {
      throw new BadRequestError("Code OTP invalide ou expiré");
    }
    if (otpRecord.code !== code) {
      throw new BadRequestError("Code OTP incorrect");
    }

    await authRepository.markOtpUsed(otpRecord.id);

    const user = await authRepository.upsertDonorAfterOtp({
      email,
      ...(donorData || {}),
    });

    // ✅ Sécurité — si l'user n'existe pas et phone absent (reconnexion sans compte)
    if (!user) {
      throw new NotFoundError(
        "Aucun compte trouvé pour cet email. Veuillez vous inscrire d'abord.",
      );
    }

    const { accessToken, refreshToken, expiresAt } = buildTokenPair(
      user.id,
      user.role,
    );

    await authRepository.storeRefreshToken(user.id, refreshToken, expiresAt);

    logger.logEvent("OTP_VERIFIED", { userId: user.id, email });

    return {
      message: "Vérification réussie. Bienvenue dans la communauté Jambaar !",
      accessToken,
      refreshToken,
      user,
    };
  }

  // ── 5. Login email + password (agents & admin) ───────────────
  async login({ email, password }) {
    // Timing-safe : on cherche l'utilisateur même si absent (DUMMY_HASH)
    const user = await authRepository.findByEmail(email);

    const hashToCompare = user?.passwordHash ?? env.DUMMY_HASH;
    const isValid = await comparePassword(password, hashToCompare);

    if (!user || !isValid) {
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    if (!user.isActive) {
      throw new ForbiddenError("Compte suspendu. Contactez l'administration.");
    }

    // Seuls les agents de santé et admins utilisent le login classique
    if (user.role === "DONOR") {
      throw new ForbiddenError("Les donneurs se connectent via le code OTP.");
    }

    const { accessToken, refreshToken, expiresAt } = buildTokenPair(
      user.id,
      user.role,
    );
    await authRepository.storeRefreshToken(user.id, refreshToken, expiresAt);

    logger.logEvent("LOGIN_SUCCESS", { userId: user.id, role: user.role });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isStructureAdmin: user.isStructureAdmin,
        healthStructureId: user.healthStructureId,
      },
    };
  }

  // ── 6. Refresh access token ──────────────────────────────────
  async refresh({ refreshToken }) {
    let decoded;
    try {
      decoded = tokenGenerator.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedError("Refresh token invalide ou expiré");
    }

    const user = await authRepository.findByRefreshToken(refreshToken);

    if (!user) {
      // Token rotation attack — le refresh token n'est plus en DB
      throw new UnauthorizedError(
        "Session invalide. Veuillez vous reconnecter.",
      );
    }

    if (!user.isActive) {
      throw new ForbiddenError("Compte suspendu.");
    }

    // Rotation du refresh token (invalidation de l'ancien)
    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    } = buildTokenPair(user.id, user.role);
    await authRepository.storeRefreshToken(user.id, newRefreshToken, expiresAt);

    logger.logEvent("TOKEN_REFRESHED", { userId: user.id });

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ── 7. Logout ────────────────────────────────────────────────
  async logout(userId) {
    await authRepository.revokeRefreshToken(userId);
    logger.logEvent("LOGOUT", { userId });
    return { message: "Déconnexion réussie." };
  }

  // ── Inscription CNTS ────────────────────────────────
  async registerCnts(data) {
    const { email, phone, registrationNumber } = data;

    // Vérifications unicité
    const [existingEmail, existingPhone, existingReg] = await Promise.all([
      authRepository.findByEmail(email),
      authRepository.findByPhone(phone),
      authRepository.findByRegistrationNumber(registrationNumber),
    ]);

    if (existingEmail)
      throw new ConflictError("Cette adresse email est déjà utilisée");
    if (existingPhone)
      throw new ConflictError("Ce numéro de téléphone est déjà utilisé");
    if (existingReg)
      throw new ConflictError("Ce numéro d'enregistrement est déjà utilisé");

    const passwordHash = await hashPassword(data.password);

    const { structure, director } = await authRepository.createCntsWithDirector(
      {
        ...data,
        passwordHash,
      },
    );

    logger.logEvent("CNTS_REGISTERED", {
      structureId: structure.id,
      directorId: director.id,
    });

    return {
      message:
        "CNTS inscrite avec succès. En attente de vérification par l'administration.",
      director,
      structure,
    };
  }

  // ── Inscription Hôpital ────────────────────────────────
  async registerHospital(data) {
    const { email, phone, registrationNumber, affiliatedCntsId } = data;

    // 1. Vérifier que la CNTS d'affiliation existe BIEN et est de type CNTS
    // ← MODIFICATION : Appel au repository au lieu de prisma.direct
    const cntsExists = await authRepository.findValidCntsById(affiliatedCntsId);
    if (!cntsExists) {
      throw new NotFoundError(
        "La CNTS d'affiliation spécifiée est introuvable ou n'est pas valide.",
      );
    }

    // 2. Vérifications unicité
    const [existingEmail, existingPhone, existingReg] = await Promise.all([
      authRepository.findByEmail(email),
      authRepository.findByPhone(phone),
      authRepository.findByRegistrationNumber(registrationNumber),
    ]);

    if (existingEmail)
      throw new ConflictError("Cette adresse email est déjà utilisée");
    if (existingPhone)
      throw new ConflictError("Ce numéro de téléphone est déjà utilisé");
    if (existingReg)
      throw new ConflictError("Ce numéro d'enregistrement est déjà utilisé");

    const passwordHash = await hashPassword(data.password);

    const { structure, director } =
      await authRepository.createHospitalWithDirector({
        ...data,
        passwordHash,
      });

    logger.logEvent("HOSPITAL_REGISTERED", {
      structureId: structure.id,
      affiliatedTo: affiliatedCntsId,
    });

    return {
      message: "Hôpital inscrit avec succès. En attente de vérification.",
      director,
      structure,
    };
  }
}

export default new AuthService();
