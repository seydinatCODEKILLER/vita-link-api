import { env } from "./env.js";

export const getCorsOptions = () => {
  const allowedWebOrigins = [env.WEB_URL, env.WEB_URL_DEV,env.SWAGGER_URL, env.WEB_URL_DEV_2].filter(Boolean);

  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!env.IS_PROD || allowedWebOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origine non autorisée : ${origin}`));
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-Api-Key",
    ],

    credentials: false,
    maxAge: 86400,
  };
};
