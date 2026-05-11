
// ─── Configuration des points ─────────────────────────────────
export const POINTS_CONFIG = {
  DONATION_BASE: 50,          // Don standard
  DONATION_VITAL: 100,        // Don en urgence VITAL
  REACTION_FAST: 20,          // Bonus si arrivée < 1h
  RARE_BLOOD_BONUS: 50,       // Bonus si O- ou AB-
};

// ─── Configuration des grades ─────────────────────────────────
export const GRADE_THRESHOLDS = {
  ASPIRANT: 0,
  SENTINELLE: 200,
  AMBASSADEUR: 500,
};

// ─── Configuration éligibilité ────────────────────────────────
export const ELIGIBILITY_DAYS = {
  MALE: 90,
  FEMALE: 120,
};

/**
 * Calcule les points à attribuer après un don validé
 */
export const calculateDonationPoints = ({ urgencyLevel, bloodType, etaMinutes }) => {
  let points = urgencyLevel === "VITAL"
    ? POINTS_CONFIG.DONATION_VITAL
    : POINTS_CONFIG.DONATION_BASE;

  // Bonus sang rare
  if (["O_NEG", "AB_NEG"].includes(bloodType)) {
    points += POINTS_CONFIG.RARE_BLOOD_BONUS;
  }

  // Bonus réactivité (arrivée en moins d'1h)
  if (etaMinutes && etaMinutes <= 60) {
    points += POINTS_CONFIG.REACTION_FAST;
  }

  return points;
};

/**
 * Détermine le grade selon le total de points
 */
export const calculateGrade = (totalPoints) => {
  if (totalPoints >= GRADE_THRESHOLDS.AMBASSADEUR) return "AMBASSADEUR";
  if (totalPoints >= GRADE_THRESHOLDS.SENTINELLE) return "SENTINELLE";
  return "ASPIRANT";
};

/**
 * Calcule la date du prochain don éligible
 */
export const calculateNextEligibility = (gender) => {
  const days = gender === "FEMALE"
    ? ELIGIBILITY_DAYS.FEMALE
    : ELIGIBILITY_DAYS.MALE;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

/**
 * Vérifie si un donneur est éligible à donner aujourd'hui
 */
export const isDonorEligible = (nextEligibilityAt) => {
  if (!nextEligibilityAt) return true;
  return new Date() >= new Date(nextEligibilityAt);
};