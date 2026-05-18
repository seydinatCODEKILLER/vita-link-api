// ─── Règle métier ABSOLUE ─────────────────────────────────────
// Une alerte est active si ET SEULEMENT SI son statut l'exige 
// ET qu'elle n'est pas temporellement expirée.

export const ACTIVE_ALERT_STATUSES = ["ACTIVE", "QUOTA_REACHED"];

export const getActiveAlertFilter = () => {
  const now = new Date();

  return {
    status: { in: ACTIVE_ALERT_STATUSES },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } }
    ]
  };
};