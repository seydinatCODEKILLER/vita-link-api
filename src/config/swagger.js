export const swaggerOptions = {
  openapi: "3.0.0",

  info: {
    title: "Vita-Link API",
    version: "1.0.0",
    description: `
      <h2>🩸 Infrastructure numérique d'urgence sanguine</h2>
      <p><b>Vita-Link</b> connecte les donneurs de sang (Jambaars) aux structures de santé en temps réel grâce à un système de géolocalisation avancé, couplé à un programme de gamification (Jambaar Life) pour booster la rétention.</p>
      
      <h3>🔐 Authentification</h3>
      <p>Certaines routes nécessitent un token JWT. Cliquez sur le bouton <b>"Authorize"</b> en haut à droite et saisissez votre token (sans le "Bearer ").</p>
      <p><b>Rôles :</b> DONOR, HEALTH_STRUCTURE, ADMIN</p>
    `,
    contact: {
      name: "Equipe Vita-Link",
      email: "admin@vitalink.sn",
    },
  },

  // Les serveurs disponibles (utile si vous déployez sur Render/Railway)
  servers: [
    {
      url: "http://localhost:3000/api",
      description: "Serveur de développement local",
    },
    // {
    //   url: "https://vita-link-api.onrender.com/api",
    //   description: "Serveur de production (Hackathon)",
    // },
  ],

  // Définition du système de sécurité (JWT)
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Entrez votre token JWT obtenu via les endpoints /auth/*",
      },
    },
  },

  // Sécurité globale par défaut (optionnel, vous pouvez aussi la mettre route par route)
  // Si vous décommentez ça, toutes les routes exigeront le token par défaut dans Swagger
  security: [
    { BearerAuth: [] }
  ],

  // Organisation des endpoints par catégories dans l'UI
  tags: [
    { name: "Auth", description: "Inscription, Connexion, OTP et Tokens" },
    {
      name: "Users",
      description:
        "Gestion du profil donneur (Avatar, Localisation, Disponibilité)",
    },
    {
      name: "Health Structures",
      description:
        "Inscription des hôpitaux et gestion des agents par le directeur",
    },
    {
      name: "Alerts",
      description: "Création et suivi des alertes sanguines (Cœur du système)",
    },
    {
      name: "Alert Responses",
      description:
        "Actions du donneur (J'y vais, Refus) et suivi par l'hôpital",
    },
    {
      name: "Donations",
      description: "Validation des dons par QR Code et historiques",
    },
    {
      name: "Jambaar Profile",
      description:
        "Gamification : Points, Grades, Éligibilité et Classements (Leaderboard)",
    },
    { name: "Badges", description: "CRUD des badges de succès (Admin)" },
    {
      name: "Partners",
      description: "Gestion des partenaires commerciaux (Admin)",
    },
    {
      name: "Rewards",
      description: "Catalogue des récompenses échangeables contre des points",
    },
    {
      name: "Coupons",
      description: "Génération et utilisation des coupons par les donneurs",
    },
    {
      name: "Blood Stocks",
      description: "Gestion des stocks de poches de sang par structure",
    },
    {
      name: "Notifications",
      description: "Historique des notifications Expo Push/SMS",
    },
    {
      name: "Admin",
      description:
        "Tableau de bord, KPIs, Modération et Validation des structures",
    },
  ],

  // Où Swagger doit chercher les commentaires JSDoc pour générer la doc
  apis: [
    "./modules/**/*.routes.js",
    "./shared/middlewares/*.js",
  ],
};
