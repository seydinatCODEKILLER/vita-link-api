import QRCode from "qrcode";
import { nanoid } from "nanoid";

/**
 * Génère un code unique court pour identifier la donation
 * Ex: "VITA-X9K2-M4P7"
 */
export const generateDonationCode = () => {
  return `VITA-${nanoid(4).toUpperCase()}-${nanoid(4).toUpperCase()}`;
};

/**
 * Génère un QR code en base64 PNG à afficher sur le téléphone du donneur
 * C'est ce QR que l'hôpital va scanner à l'arrivée du donneur
 */
export const generateQrCodeBase64 = async (donationCode) => {
  const buffer = await QRCode.toBuffer(donationCode, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: { dark: "#C0392B", light: "#FFFFFF" }, // Rouge Vita-Link
  });
  return buffer.toString("base64");
};

/**
 * Génère le code + le QR en une seule opération
 * Appelé dans alertResponse.service.js au moment du confirm
 */
export const generateDonationQr = async () => {
  const code = generateDonationCode();
  const qrBase64 = await generateQrCodeBase64(code);
  return { code, qrBase64 };
};