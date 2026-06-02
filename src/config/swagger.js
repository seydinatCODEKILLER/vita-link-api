export const swaggerOptions = {
  openapi: "3.0.0",

  info: {
    title: "Vita-Link API",
    version: "2.0.0", // ← Mise à jour de version pour refléter le changement d'architecture
    description: `
      <h2>🩸 Infrastructure numérique d'urgence sanguine</h2>
      <p><b>Vita-Link</b> connecte les donneurs de sang (Jambaars) aux structures de santé en temps réel grâce à un système de géolocalisation avancé, couplé à un programme de gamification (Jambaar Life) pour booster la rétention.</p>
      
      <h3>🏥 Nouveauté : Modèle CNTS / Hôpitaux</h3>
      <p>Le système reproduit la réalité sénégalaise : les hôpitaux ne gèrent pas de stock. Ils soumettent des <b>Demandes de Sang (Blood Requests)</b> à la <b>CNTS</b> à laquelle ils sont affiliés. La CNTS fournit le stock ou déclenche une alerte publique aux donneurs si le stock est insuffisant.</p>
      
      <h3>🔐 Authentification</h3>
      <p>Certaines routes nécessitent un token JWT. Cliquez sur le bouton <b>"Authorize"</b> en haut à droite et saisissez votre token (sans le "Bearer ").</p>
      <p><b>Rôles :</b> DONOR, CNTS_AGENT, CNTS_ADMIN, HOSPITAL_AGENT, ADMIN</p>
    `,
    contact: {
      name: "Equipe Vita-Link",
      email: "admin@vitalink.sn",
    },
  },

  servers: [
    {
      url: "http://localhost:3000/api",
      description: "Serveur de développement local",
    },
    {
      url: "https://vita-link-api.onrender.com/api",
      description: "Serveur de production",
    },
  ],

  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Entrez votre token JWT obtenu via les endpoints /auth/*",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Ressource introuvable" },
          errors: {
            type: "array",
            items: { type: "object" },
            description: "Détails des erreurs de validation Zod (optionnel)",
          },
        },
      },
      RegisterDonorDTO: {
        type: "object",
        required: ["firstName", "lastName", "phone", "bloodType", "gender"],
        properties: {
          firstName: { type: "string", example: "Aliou" },
          lastName: { type: "string", example: "Diallo" },
          phone: { type: "string", example: "+221771234567" },
          email: {
            type: "string",
            format: "email",
            example: "aliou@gmail.com",
          },
          bloodType: {
            type: "string",
            enum: [
              "A_POS",
              "A_NEG",
              "B_POS",
              "B_NEG",
              "AB_POS",
              "AB_NEG",
              "O_POS",
              "O_NEG",
            ],
          },
          gender: { type: "string", enum: ["MALE", "FEMALE"] },
          dateOfBirth: {
            type: "string",
            format: "date",
            example: "1995-06-15",
          },
        },
      },
      // ← NOUVEAU : Remplace RegisterHealthStructureDTO
      RegisterCntsDTO: {
        type: "object",
        required: [
          "firstName",
          "lastName",
          "email",
          "phone",
          "password",
          "structureName",
          "registrationNumber",
          "address",
          "region",
        ],
        properties: {
          firstName: { type: "string", example: "Dr. Aminata" },
          lastName: { type: "string", example: "Diop" },
          email: {
            type: "string",
            format: "email",
            example: "admin.cnts@transfusion.sn",
          },
          phone: { type: "string", example: "+221338000000" },
          password: {
            type: "string",
            format: "password",
            example: "CntsSecure2024!",
          },
          structureName: {
            type: "string",
            example: "Centre National de Transfusion Sanguine de Dakar",
          },
          registrationNumber: { type: "string", example: "CNTS-DKR-001" },
          address: { type: "string", example: "Avenue Blaise Diagne, Dakar" },
          region: {
            type: "string",
            description: "Région administrative du Sénégal",
            enum: [
              "Dakar",
              "Diourbel",
              "Fatick",
              "Kaffrine",
              "Kaolack",
              "Kédougou",
              "Kolda",
              "Louga",
              "Matam",
              "Sédhiou",
              "Saint-Louis",
              "Tambacounda",
              "Thiès",
              "Ziguinchor",
            ],
            example: "Dakar",
          },
          structurePhone: { type: "string", example: "+221338000001" },
          structureEmail: {
            type: "string",
            format: "email",
            example: "contact@cnts-dakar.sn",
          },
          latitude: { type: "number", example: 14.6937 },
          longitude: { type: "number", example: -17.4441 },
        },
      },
      // ← NOUVEAU : Remplace RegisterHealthStructureDTO
      RegisterHospitalDTO: {
        type: "object",
        required: [
          "firstName",
          "lastName",
          "email",
          "phone",
          "password",
          "structureName",
          "registrationNumber",
          "address",
          "region",
          "structureType",
          "affiliatedCntsId",
        ],
        properties: {
          firstName: { type: "string", example: "Dr. Moussa" },
          lastName: { type: "string", example: "Sow" },
          email: { type: "string", format: "email", example: "dr.sow@hpd.sn" },
          phone: { type: "string", example: "+221771234567" },
          password: {
            type: "string",
            format: "password",
            example: "Motdepasse123!",
          },
          structureName: {
            type: "string",
            example: "Hôpital Principal de Dakar",
          },
          registrationNumber: { type: "string", example: "SN-MED-2024-001" },
          address: { type: "string", example: "Avenue Nelson Mandela, Dakar" },
          region: {
            type: "string",
            description: "Région administrative du Sénégal",
            enum: [
              "Dakar",
              "Diourbel",
              "Fatick",
              "Kaffrine",
              "Kaolack",
              "Kédougou",
              "Kolda",
              "Louga",
              "Matam",
              "Sédhiou",
              "Saint-Louis",
              "Tambacounda",
              "Thiès",
              "Ziguinchor",
            ],
            example: "Dakar",
          },
          structureType: {
            type: "string",
            description: "Type d'établissement de soins",
            enum: ["HOSPITAL", "HEALTH_CENTER"],
            example: "HOSPITAL",
          },
          affiliatedCntsId: {
            type: "string",
            format: "uuid",
            description: "OBLIGATOIRE : L'UUID de la CNTS de rattachement.",
            example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          },
          structurePhone: { type: "string", example: "+221338201234" },
          structureEmail: {
            type: "string",
            format: "email",
            example: "contact@hpd.sn",
          },
          latitude: { type: "number", example: 14.6937 },
          longitude: { type: "number", example: -17.4441 },
        },
      },
      VerifyOtpDTO: {
        type: "object",
        required: [
          "email",
          "code",
          "phone",
          "bloodType",
          "gender",
          "firstName",
          "lastName",
        ],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "aliou@gmail.com",
          },
          code: { type: "string", example: "483921" },
          firstName: { type: "string", example: "Aliou" },
          lastName: { type: "string", example: "Diallo" },
          phone: { type: "string", example: "+221771234567" },
          bloodType: { type: "string", enum: ["O_NEG"] },
          gender: { type: "string", enum: ["MALE"] },
        },
      },
    },
  },

  security: [{ BearerAuth: [] }],

  tags: [
    {
      name: "Auth",
      description:
        "Inscription (Donneur, CNTS, Hôpital), Connexion, OTP et Tokens",
    },
    {
      name: "Users",
      description:
        "Gestion du profil donneur (Avatar, Localisation, Disponibilité)",
    },
    {
      name: "Health Structures",
      description:
        "Gestion des structures de santé (CNTS & Hôpitaux), staff et affiliation",
    },
    {
      name: "Blood Requests", // ← NOUVEAU TAG
      description:
        "Demandes de sang des Hôpitaux vers la CNTS (Workflow central du système)",
    },
    {
      name: "Alerts",
      description:
        "Création et suivi des alertes sanguines publiques (Vers les donneurs)",
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
      description:
        "Gestion des stocks de poches de sang (Exclusivement par la CNTS)",
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

  apis: ["./src/modules/**/*.routes.js", "./src/shared/middlewares/*.js"],
};
