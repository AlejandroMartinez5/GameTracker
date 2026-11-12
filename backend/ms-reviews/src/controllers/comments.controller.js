const commentsService = require("../services/comments.service");

const handleError = (res, error, fallbackMessage) => {
  return res.status(error.status || 500).json({
    message: error.status ? error.message : fallbackMessage
  });
};

const createComment = async (req, res) => {
  try {
    const comment = await commentsService.createComment(
      req.params.reviewId,
      req.body || {},
      req.user
    );

    return res.status(201).json({
      message: "Comentario creado correctamente",
      data: comment
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getCommentsByReview = async (req, res) => {
  try {
    const result = await commentsService.getCommentsByReview(
      req.params.reviewId,
      req.query,
      req.user
    );

    return res.status(200).json({
      message: "Comentarios obtenidos correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getCommentById = async (req, res) => {
  try {
    const comment = await commentsService.getCommentById(req.params.commentId);

    return res.status(200).json({
      message: "Comentario obtenido correctamente",
      data: comment
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const deleteComment = async (req, res) => {
  try {
    const result = await commentsService.deleteComment(
      req.params.commentId,
      req.user
    );

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const removeCommentImage = async (req, res) => {
  try {
    const result = await commentsService.removeCommentImage(
      req.params.commentId,
      req.user
    );

    return res.status(200).json({
      message: "Imagen del comentario eliminada correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const likeComment = async (req, res) => {
  try {
    const result = await commentsService.likeComment(
      req.params.commentId,
      req.user
    );

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const unlikeComment = async (req, res) => {
  try {
    const result = await commentsService.unlikeComment(
      req.params.commentId,
      req.user
    );

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getCommentLikes = async (req, res) => {
  try {
    const result = await commentsService.getCommentLikes(req.params.commentId);

    return res.status(200).json({
      message: "Likes obtenidos correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

module.exports = {
  createComment,
  getCommentsByReview,
  getCommentById,
  deleteComment,
  removeCommentImage,
  likeComment,
  unlikeComment,
  getCommentLikes
};
