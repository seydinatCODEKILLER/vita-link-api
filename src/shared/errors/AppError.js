export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(msg) {
    super(msg, 400, "VALIDATION_ERROR");
  }
}

export class BadRequestError extends AppError {
  constructor(msg = "Requête invalide") {
    super(msg, 400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Non autorisé") {
    super(msg, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Accès refusé") {
    super(msg, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Ressource") {
    super(`${resource} introuvable`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(msg) {
    super(msg, 409, "CONFLICT");
  }
}
