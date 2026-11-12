const reviewsService = require("../services/reviews.service");

const getToken = (req) => {
  return (req.get("authorization") || "").split(" ")[1];
};

const handleError = (res, error, fallbackMessage) => {
  return res.status(error.status || 500).json({
    message: error.status ? error.message : fallbackMessage
  });
};

const createReview = async (req, res) => {
  try {
    const review = await reviewsService.createReview(req.body || {}, req.user, {
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
      req.body || {},
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
  getReviewById,
  updateReview,
  deleteReview,
  removeReviewImage,
  likeReview,
  unlikeReview,
  getReviewLikes
};
