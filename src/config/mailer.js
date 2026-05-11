import * as Brevo from "@getbrevo/brevo";
import { env } from "./env.js";
import logger from "./logger.js";

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.authentications["apiKey"].apiKey = env.BREVO_API_KEY;

/**
 * Envoie un email transactionnel via Brevo
 * @param {object} options
 * @param {string} options.to - Email destinataire
 * @param {string} options.toName - Nom destinataire
 * @param {string} options.subject - Sujet
 * @param {string} options.html - Contenu HTML
 * @param {Array}  options.attachments - Pièces jointes [{ naname
 * me, content (base64) }]
 */
export const sendEmail = async ({
  to,
  toName,
  subject,
  html,
  attachments = [],
}) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  sendSmtpEmail.sender = {
    name: "Vita-Link",
    email: env.MAIL_FROM,
  };

  sendSmtpEmail.to = [{ email: to, name: toName || to }];
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;

  if (attachments.length > 0) {
    sendSmtpEmail.attachment = attachments.map(({ name, content }) => ({
      name,
      content,
    }));
  }

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info({ to, subject, messageId: result.messageId }, "Email envoyé");
    return result;
  } catch (err) {
    logger.error({ err, to, subject }, "Échec envoi email");
    throw err;
  }
};
