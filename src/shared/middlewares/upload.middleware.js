import multer from "multer";
import { AppError } from "../errors/AppError.js";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Seules les images sont autorisées", 400), false);
  }
};

export const uploadSingle = (fieldName) =>
  multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, 
  }).single(fieldName);