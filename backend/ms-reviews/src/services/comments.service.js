const commentsRepository = require("../repositories/comments.repository");
const reviewsRepository = require("../repositories/reviews.repository");
const events = require("../utils/events.util");
const {
  getPaginationParams,
  buildPaginationMeta
} = require("../utils/pagination.util");

const MAX_INTEGER = 2147483647;

const createError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parseId = (value, fieldName) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_INTEGER) {
    throw createError(`${fieldName} debe ser un entero mayor a 0`, 400);
  }

  return parsed;
};

const validateContent = (content) => {
  if (typeof content !== "string" || !content.trim()) {
    throw createError("El contenido del comentario es obligatorio", 400);
  }

  return content.trim();
};

const getExistingReview = async (reviewId) => {
  const review = await reviewsRepository.findById(parseId(reviewId, "reviewId"));

  if (!review) {
    throw createError("Reseña no encontrada", 404);
  }

  return review;
};

const getExistingComment = async (commentId) => {
  const comment = await commentsRepository.findById(parseId(commentId, "commentId"));

  if (!comment) {
    throw createError("Comentario no encontrado", 404);
  }

  return comment;
};

const isOwnerOrAdmin = (comment, user) => {
  return comment.auth_id === user.authId || user.role === "ADMIN";
};

const createComment = async (reviewId, { content }, user) => {
  const review = await getExistingReview(reviewId);
  const text = validateContent(content);

  const comment = await commentsRepository.createComment({
    reviewId: review.id,
    authId: user.authId,
    content: text
  });

  events.publishReviewCommented({ review, comment });

  return comment;
};

const getCommentsByReview = async (reviewId, paginationQuery, user = null) => {
  const review = await getExistingReview(reviewId);
  const paginationParams = getPaginationParams(paginationQuery);

  const total = await commentsRepository.countByReviewId(review.id);
  const comments = await commentsRepository.findByReviewId(
    review.id,
    paginationParams,
    user?.authId || null
  );

  return {
    comments,
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getCommentById = async (commentId) => {
  return getExistingComment(commentId);
};

const deleteComment = async (commentId, user) => {
  const comment = await getExistingComment(commentId);

  if (!isOwnerOrAdmin(comment, user)) {
    throw createError("No tienes permisos para eliminar este comentario", 403);
  }

  await commentsRepository.deleteComment(comment.id);

  return { message: "Comentario eliminado correctamente" };
};

const removeCommentImage = async (commentId, user) => {
  const comment = await getExistingComment(commentId);

  if (!isOwnerOrAdmin(comment, user)) {
    throw createError("No tienes permisos para quitar esta imagen", 403);
  }

  const updatedComment = await commentsRepository.updateCommentImage({
    commentId: comment.id,
    imageUrl: null
  });

  return {
    commentId: comment.id,
    reviewId: comment.review_id,
    imageUrl: null,
    comment: updatedComment
  };
};

const likeComment = async (commentId, user) => {
  const comment = await getExistingComment(commentId);

  const like = await commentsRepository.likeComment({
    commentId: comment.id,
    authId: user.authId
  });

  if (!like) {
    return { message: "Ya habías dado like a este comentario" };
  }

  events.publishCommentLiked({ comment, actorAuthId: user.authId });

  return { message: "Like agregado correctamente" };
};

const unlikeComment = async (commentId, user) => {
  const removedLike = await commentsRepository.unlikeComment({
    commentId: parseId(commentId, "commentId"),
    authId: user.authId
  });

  if (!removedLike) {
    throw createError("No habías dado like a este comentario", 404);
  }

  return { message: "Like eliminado correctamente" };
};

const getCommentLikes = async (commentId) => {
  const comment = await getExistingComment(commentId);
  const likesCount = await commentsRepository.countLikes(comment.id);

  return { commentId: comment.id, likesCount };
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
