import { Server } from "socket.io";
import TokenGenerator from "./jwt.js";
import { prisma } from "./database.js";
import logger from "./logger.js";

const tokenGenerator = new TokenGenerator();

let io = null;

// ─── Initialisation ────────────────────────────────────────────
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Middleware auth ──────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("TOKEN_MISSING"));

      const decoded = tokenGenerator.verify(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          healthStructureId: true,
        },
      });

      if (!user) return next(new Error("USER_NOT_FOUND"));
      if (!user.isActive) return next(new Error("ACCOUNT_SUSPENDED"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("TOKEN_INVALID"));
    }
  });

  // ─── Connexion ────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { id, firstName, lastName, role, healthStructureId } = socket.user;
    const fullName = `${firstName} ${lastName}`;

    logger.info({ userId: id, role, socketId: socket.id }, `🔌 ${fullName} connecté`);

    // ─── Room personnelle (notifs ciblées) ────────────────────
    socket.join(`user:${id}`);

    // ─── Room automatique selon le rôle ──────────────────────
    // Le donneur rejoint sa room de rôle pour les broadcasts massifs
    if (role === "DONOR") {
      socket.join("donors");
    }

    // L'agent/directeur rejoint automatiquement la room de sa structure
    if (
      (role === "HEALTH_STRUCTURE") &&
      healthStructureId
    ) {
      socket.join(`structure:${healthStructureId}`);
      logger.info(
        { userId: id, structureId: healthStructureId },
        `${fullName} a rejoint la room structure:${healthStructureId}`,
      );
    }

    // L'admin rejoint une room globale
    if (role === "ADMIN") {
      socket.join("admins");
    }

    // ─── Rejoindre la room d'une alerte ──────────────────────
    // Appelé par le médecin quand il ouvre le dashboard de suivi
    // en temps réel des confirmations de donneurs
    socket.on("join:alert", ({ alertId }) => {
      if (!alertId) return;

      // Seuls les agents de santé et admins peuvent suivre une alerte
      if (role !== "HEALTH_STRUCTURE" && role !== "ADMIN") return;

      socket.join(`alert:${alertId}`);
      logger.info(
        { userId: id, alertId },
        `${fullName} a rejoint la room alert:${alertId}`,
      );
    });

    // ─── Quitter la room d'une alerte ────────────────────────
    socket.on("leave:alert", ({ alertId }) => {
      if (!alertId) return;
      socket.leave(`alert:${alertId}`);
      logger.info(
        { userId: id, alertId },
        `${fullName} a quitté la room alert:${alertId}`,
      );
    });

    // ─── Déconnexion ──────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info(
        { userId: id, socketId: socket.id, reason },
        `🔌 ${fullName} déconnecté`,
      );
    });

    // ─── Erreur ───────────────────────────────────────────────
    socket.on("error", (err) => {
      logger.error({ userId: id, err }, "Erreur socket");
    });
  });

  logger.info("Socket.io initialisé");
  return io;
};

// ─── Getter global ─────────────────────────────────────────────
export const getIO = () => {
  if (!io) throw new Error("Socket.io non initialisé");
  return io;
};

// ─── Helpers d'émission ────────────────────────────────────────

// Notif ciblée à un donneur spécifique
// Utilisé pour : confirmation de don, points crédités, badge débloqué
export const emitToUser = (userId, event, data) => {
  getIO().to(`user:${userId}`).emit(event, data);
};

// Notif à tous les donneurs connectés
// Utilisé pour : broadcast d'une nouvelle alerte dans la zone
export const emitToDonors = (event, data) => {
  getIO().to("donors").emit(event, data);
};

// Notif en temps réel sur le dashboard de suivi d'une alerte
// Utilisé pour : nouveau "J'y vais", mise à jour ETA, quota atteint
export const emitToAlert = (alertId, event, data) => {
  getIO().to(`alert:${alertId}`).emit(event, data);
};

// Notif à tous les membres d'une structure de santé
// Utilisé pour : mise à jour stock critique, stats en temps réel
export const emitToStructure = (structureId, event, data) => {
  getIO().to(`structure:${structureId}`).emit(event, data);
};

// Notif aux admins connectés
// Utilisé pour : nouvelle structure en attente, alerte système
export const emitToAdmins = (event, data) => {
  getIO().to("admins").emit(event, data);
};

// Broadcast global (tous les connectés)
// Utilisé pour : maintenance, message système urgent
export const emitToAll = (event, data) => {
  getIO().emit(event, data);
};