// Pour la liste des alertes sur la Home (Strict : on ne montre que les urgences en cours)
export const getActiveAlertFilter = () => {
  const now = new Date();
  return {
    status: { in: ["ACTIVE", "QUOTA_REACHED"] },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
};

// ✅ NOUVEAU : Pour l'engagement du donneur (Souple : tant qu'il n'a pas annulé ou été scanné, il est engagé)
export const getEngagementAlertFilter = () => {
  const now = new Date();
  return {
    status: { in: ["ACTIVE", "QUOTA_REACHED", "EXPIRED"] }, // On inclut EXPIRED !
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
      { status: { in: ["QUOTA_REACHED", "EXPIRED"] } }, // ✅ Si quota atteint ou expiré, on ignore la date
    ],
  };
};
