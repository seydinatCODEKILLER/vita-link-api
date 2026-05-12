import cloudinary from "../../config/cloudinary.js";
import logger from "../../config/logger.js";

class MediaUploader {
  constructor() {
    this.uploadResults = new Map();
  }

  async upload(file, folder = "vita-link/avatars", prefix = "avatar") {
    if (!file || !file.buffer) return null;

    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: `${prefix}_${Date.now()}`,
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        stream.end(file.buffer);
      });

      this.uploadResults.set(prefix, {
        public_id: result.public_id,
        url: result.secure_url,
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error) {
      logger.error({ err: error }, "Upload multer file failed");
      throw error;
    }
  }

  async uploadBuffer(
    buffer,
    folder = "eventflow/qrcodes",
    prefix = "qr",
    resourceType = "image",
  ) {
    if (!buffer) return null;

    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: `${prefix}_${Date.now()}`,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        stream.end(buffer);
      });

      this.uploadResults.set(prefix, {
        public_id: result.public_id,
        url: result.secure_url,
      });

      logger.info(
        { public_id: result.public_id, folder },
        "Buffer uploaded to Cloudinary",
      );

      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error) {
      logger.error({ err: error }, "Upload buffer failed");
      throw error;
    }
  }

  async rollback(publicId) {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      this.uploadResults.delete(publicId);
      logger.info({ public_id: publicId }, "Rollback successful");
    } catch (error) {
      logger.error({ err: error }, "Rollback failed");
    }
  }

  async deleteByPublicId(publicId) {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      logger.info({ public_id: publicId }, "Media deleted");
    } catch (error) {
      logger.error({ err: error }, "Delete by public_id failed");
    }
  }

  async deleteByUrl(url) {
    if (!url) return;
    try {
      const urlParts = url.split("/");
      const uploadIndex = urlParts.indexOf("upload");
      const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join("/");
      const publicId = publicIdWithExtension.substring(
        0,
        publicIdWithExtension.lastIndexOf("."),
      );
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        logger.info({ public_id: publicId }, "Media deleted by URL");
      }
    } catch (error) {
      logger.error({ err: error }, "Delete by URL failed");
    }
  }
}

export default MediaUploader;
