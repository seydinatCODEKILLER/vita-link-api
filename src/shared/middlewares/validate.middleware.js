import { ValidationError } from "../errors/AppError.js";

/**
 * Middleware générique Zod — valide body + params + query.
 * Le schema Zod doit être structuré avec les clés { body, params, query }.
 *
 * Usage: validate(MySchema)
 * Accès dans le controller: req.validated.body / req.validated.params / req.validated.query
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const message = Object.entries(result.error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
      .join(" | ");
    return next(new ValidationError(message));
  }

  req.validated = result.data;
  next();
};

/**
 * Variante — valide uniquement le body.
 * Le schema Zod est un schema plat (sans clés body/params/query).
 *
 * Usage: validateBody(MySchema)
 * Accès dans le controller: req.validated
 */
export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = Object.entries(result.error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
      .join(" | ");
    return next(new ValidationError(message));
  }

  req.validated = result.data;
  next();
};