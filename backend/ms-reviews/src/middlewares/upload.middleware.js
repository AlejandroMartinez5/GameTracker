const multer = require("multer");

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_IMAGE_UPLOAD_BYTES) || DEFAULT_MAX_IMAGE_BYTES
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return callback(new Error("Formato de imagen no permitido. Usa JPG o PNG"));
    }

    return callback(null, true);
  }
});

const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "La imagen supera el tamaño máximo permitido"
      });
    }

    return res.status(400).json({
      message: error.message || "Error al procesar la imagen"
    });
  });
};

module.exports = {
  upload,
  uploadImage
};
