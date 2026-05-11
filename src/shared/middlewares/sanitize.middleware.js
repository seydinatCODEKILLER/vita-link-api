/**
 * Middleware de nettoyage du body pour les requêtes multipart/form-data.
 *
 * Problème : multipart/form-data envoie tous les champs du formulaire,
 * même ceux laissés vides, comme des strings vides "".
 * Zod interprète "" comme une valeur présente et applique les validations
 * (.min(2), .regex(), etc.), ce qui fait échouer la validation.
 *
 * Solution : convertir récursivement toutes les strings vides en undefined
 * avant que Zod ne valide, pour qu'ils soient traités comme absents.
 */

// Regex ISO 8601 — couvre "2024-01-15", "2024-01-15T10:30:00Z", "2024-01-15T10:30:00+01:00"
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

const sanitizeValue = (value) => {
  // null / string vide → absent
  if (value === "" || value === null) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed === "") return undefined;

    // Booleans envoyés comme strings par form-data
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    // Dates ISO 8601 — startDate, endDate, scannedAt, etc.
    if (ISO_DATE_REGEX.test(trimmed)) {
      const date = new Date(trimmed);
      // Vérification que la date est valide (new Date("2024-13-01") → Invalid Date)
      if (!isNaN(date.getTime())) return date;
    }

    // // Nombres — capacity, page, limit, etc.
    // if (/^[-+]?\d*\.?\d+$/.test(trimmed)) {
    //   return Number(trimmed);
    // }

    return trimmed;
  }

  // Tableaux — nettoyage récursif de chaque élément
  if (Array.isArray(value)) {
    return value
      .map(sanitizeValue)
      .filter((v) => v !== undefined);
  }

  // Objets imbriqués
  if (typeof value === "object") {
    return sanitizeObject(value);
  }

  return value;
};

const sanitizeObject = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result;
};

/**
 * Middleware principal — à placer avant validate()
 * Uniquement utile pour multipart/form-data et application/x-www-form-urlencoded.
 * Pour application/json, express.json() gère déjà les types correctement.
 */
export const sanitizeBody = (req, _res, next) => {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("application/json")) {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }
  }

  next();
};