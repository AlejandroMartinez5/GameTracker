const reviewsService = require("../services/reviews.service");

const getToken = (req) => {
  return (req.get("authorization") || "").split(" ")[1];
};

const getImage = (file) => {
  if (!file) {
    return null;
  }

  return {
    data: file.buffer,
    mimeType: file.mimetype,
    size: file.size
  };
};

const handleError = (res, error, fallbackMessage) => {
  return res.status(error.status || 500).json({
    message: error.status ? error.message : fallbackMessage
  });
};

const createReview = async (req, res) => {
  try {
    const review = await reviewsService.createReview({
      ...(req.body || {}),
      image: getImage(req.file)
    }, req.user, {
      token: getToken(req)
    });

    return res.status(201).json({
      message: "Reseña creada correctamente",
      data: review
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getReviewsByGame = async (req, res) => {
  try {
    const result = await reviewsService.getReviewsByGame(
      req.params.igdbId,
      req.query,
      req.user
    );

    return res.status(200).json({
      message: "Reseñas obtenidas correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getReviewsByUser = async (req, res) => {
  try {
    const result = await reviewsService.getReviewsByUser(
      req.params.authId,
      req.query
    );

    return res.status(200).json({
      message: "Reseñas del usuario obtenidas correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getUserReviewsSummary = async (req, res) => {
  try {
    const summary = await reviewsService.getUserReviewsSummary(req.params.authId);

    return res.status(200).json({
      message: "Resumen de reseñas obtenido correctamente",
      data: summary
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getAdminStats = async (req, res) => {
  try {
    const result = await reviewsService.getAdminStats(req.query);

    return res.status(200).json({
      message: "Estadisticas de resenas obtenidas correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error al obtener estadisticas de resenas");
  }
};

const getReviewById = async (req, res) => {
  try {
    const review = await reviewsService.getReviewById(req.params.reviewId);

    return res.status(200).json({
      message: "Reseña obtenida correctamente",
      data: review
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const updateReview = async (req, res) => {
  try {
    const review = await reviewsService.updateReview(
      req.params.reviewId,
      { ...(req.body || {}), image: getImage(req.file) },
      req.user
    );

    return res.status(200).json({
      message: "Reseña actualizada correctamente",
      data: review
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const deleteReview = async (req, res) => {
  try {
    const result = await reviewsService.deleteReview(req.params.reviewId, req.user);

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const removeReviewImage = async (req, res) => {
  try {
    const result = await reviewsService.removeReviewImage(
      req.params.reviewId,
      req.user
    );

    return res.status(200).json({
      message: "Imagen de la reseña eliminada correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const addReviewImage = async (req, res) => {
  try {
    const image = getImage(req.file);

    if (!image) {
      return res.status(400).json({ message: "Debes enviar una imagen" });
    }

    const result = await reviewsService.addReviewImage(
      req.params.reviewId,
      image,
      req.user
    );

    return res.status(200).json({
      message: "Imagen de la reseña actualizada correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getReviewImage = async (req, res) => {
  try {
    const image = await reviewsService.getReviewImage(req.params.reviewId);

    res.set({
      "Content-Type": image.image_mime_type,
      "Content-Length": String(image.image_size),
      "Cache-Control": "public, max-age=3600"
    });

    return res.status(200).send(image.image_data);
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const likeReview = async (req, res) => {
  try {
    const result = await reviewsService.likeReview(req.params.reviewId, req.user);

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const unlikeReview = async (req, res) => {
  try {
    const result = await reviewsService.unlikeReview(req.params.reviewId, req.user);

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getReviewLikes = async (req, res) => {
  try {
    const result = await reviewsService.getReviewLikes(req.params.reviewId);

    return res.status(200).json({
      message: "Likes obtenidos correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

module.exports = {
  createReview,
  getReviewsByGame,
  getReviewsByUser,
  getUserReviewsSummary,
  getAdminStats,
  getReviewById,
  updateReview,
  deleteReview,
  removeReviewImage,
  addReviewImage,
  getReviewImage,
  likeReview,
  unlikeReview,
  getReviewLikes
};
