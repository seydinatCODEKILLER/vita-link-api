import { Expo } from "expo-server-sdk";
import logger from "./logger.js";

const expo = new Expo();

/**
 * Envoie une notification push à un seul donneur
 * Utilisé pour : don validé, badge débloqué, points crédités
 */
export const sendPushNotification = async ({
  token,
  title,
  body,
  data = {},
}) => {
  if (!Expo.isExpoPushToken(token)) {
    logger.warn({ token }, "Push token Expo invalide — envoi ignoré");
    return null;
  }

  const message = { to: token, sound: "default", title, body, data };

  try {
    const chunks = expo.chunkPushNotifications([message]);

    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);

      for (const receipt of receipts) {
        if (receipt.status === "error") {
          logger.error({ receipt }, `Erreur push Expo : ${receipt.message}`);

          if (receipt.details?.error === "DeviceNotRegistered") {
            logger.warn({ token }, "Token Expo expiré — à supprimer en DB");
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, token }, "Échec envoi push Expo");
    return null; // On ne throw pas — un token invalide ne bloque pas le flux
  }
};

/**
 * Envoie une notification push à plusieurs donneurs en une seule fois
 * Utilisé pour : broadcast nouvelle alerte médicale dans la zone
 */
export const sendMulticastPushNotification = async ({
  tokens,
  title,
  body,
  data = {},
}) => {
  if (!tokens?.length) return null;

  // Filtrer les tokens invalides avant l'envoi
  const validTokens = tokens.filter((token) => {
    const isValid = Expo.isExpoPushToken(token);
    if (!isValid) logger.warn({ token }, "Token Expo invalide filtré");
    return isValid;
  });

  if (!validTokens.length) return null;

  const messages = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
    // Priorité maximale pour les alertes médicales
    priority: "high",
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);

      for (const receipt of receipts) {
        if (receipt.status === "error") {
          failureCount++;
          logger.error({ receipt }, `Erreur push Expo : ${receipt.message}`);

          if (receipt.details?.error === "DeviceNotRegistered") {
            logger.warn("Token Expo expiré — à supprimer en DB");
          }
        } else {
          successCount++;
        }
      }
    }

    logger.info(
      { total: validTokens.length, successCount, failureCount, title },
      "Multicast push Expo envoyé",
    );

    return { successCount, failureCount };
  } catch (err) {
    logger.error({ err, title }, "Échec multicast push Expo");
    return null;
  }
};
