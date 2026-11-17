const commentsService = require("../services/comments.service");

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

const createComment = async (req, res) => {
  try {
    const comment = await commentsService.createComment(
      req.params.reviewId,
      { ...(req.body || {}), image: getImage(req.file) },
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

const addCommentImage = async (req, res) => {
  try {
    const image = getImage(req.file);

    if (!image) {
      return res.status(400).json({ message: "Debes enviar una imagen" });
    }

    const result = await commentsService.addCommentImage(
      req.params.commentId,
      image,
      req.user
    );

    return res.status(200).json({
      message: "Imagen del comentario actualizada correctamente",
      data: result
    });
  } catch (error) {
    return handleError(res, error, "Error interno del servidor");
  }
};

const getCommentImage = async (req, res) => {
  try {
    const image = await commentsService.getCommentImage(req.params.commentId);

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
  addCommentImage,
  getCommentImage,
  likeComment,
  unlikeComment,
  getCommentLikes
};
