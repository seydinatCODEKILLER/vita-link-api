import crypto from "crypto";

/**
 * Génère un code OTP numérique à 6 chiffres
 */
export const generateOtpCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Calcule la date d'expiration de l'OTP
 * Par défaut : 10 minutes
 */
export const getOtpExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Vérifie si un OTP est encore valide
 */
export const isOtpValid = (otpRecord) => {
  if (!otpRecord) return false;
  if (otpRecord.used) return false;
  if (new Date() > new Date(otpRecord.expiresAt)) return false;
  return true;
};