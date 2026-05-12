import { prisma } from "../../config/database.js";

/**
 * Trouve les donneurs compatibles dans un rayon donné
 * Appelé dans alert.service.js après création d'une alerte
 *
 * @param {number} latitude - Latitude de l'alerte
 * @param {number} longitude - Longitude de l'alerte
 * @param {number} radiusKm - Rayon de recherche en km
 * @param {string} bloodType - Groupe sanguin requis
 * @returns {Array} Liste des donneurs avec leur expoPushToken
 */
export const findNearbyDonors = async (
  latitude,
  longitude,
  radiusKm,
  bloodType,
) => {
  const donors = await prisma.$queryRaw`
    SELECT 
      u.id,
      u."firstName",
      u."lastName",
      u."expoPushToken",
      u.latitude,
      u.longitude,
      (
        6371 * acos(
          LEAST(
            1.0,
            cos(radians(${latitude})) * cos(radians(u.latitude)) *
            cos(radians(u.longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(u.latitude))
          )
        )
      ) AS distance_km
    FROM users u
    LEFT JOIN jambars_profiles jp ON jp."userId" = u.id
    WHERE 
      u.role = 'DONOR'
      AND u."isAvailable" = true
      AND u."isActive" = true
      AND u."bloodType" = ${bloodType}::"BloodType"
      AND u.latitude IS NOT NULL
      AND u.longitude IS NOT NULL
      AND (
        jp."nextEligibilityAt" IS NULL 
        OR jp."nextEligibilityAt" <= NOW()
      )
      AND (
        6371 * acos(
          LEAST(
            1.0,
            cos(radians(${latitude})) * cos(radians(u.latitude)) *
            cos(radians(u.longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(u.latitude))
          )
        )
      ) <= ${radiusKm}
    ORDER BY distance_km ASC
  `;

  return donors;
};

/**
 * Calcule la distance en km entre deux points (Haversine)
 * Utilisé pour afficher "À X km de vous" dans l'interface donneur
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
