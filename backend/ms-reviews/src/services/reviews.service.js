const reviewsRepository = require("../repositories/reviews.repository");
const gamesClient = require("../clients/games.client");
const events = require("../utils/events.util");
const {
  getPaginationParams,
  buildPaginationMeta
} = require("../utils/pagination.util");

const REVIEW_EDIT_LIMIT_MINUTES =
  Number(process.env.REVIEW_EDIT_LIMIT_MINUTES) || 30;
const MAX_TITLE_LENGTH = 150;
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

const validateReviewData = ({ rating, title, content }) => {
  const parsedRating = Number(rating);

  if (rating === undefined || rating === null || rating === "" || !Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw createError("La calificación debe ser un entero entre 1 y 5", 400);
  }

  if (typeof content !== "string" || !content.trim()) {
    throw createError("El contenido de la reseña es obligatorio", 400);
  }

  if (title !== undefined && title !== null && typeof title !== "string") {
    throw createError("El título debe ser texto", 400);
  }

  if (title && title.trim().length > MAX_TITLE_LENGTH) {
    throw createError(`El título no puede superar ${MAX_TITLE_LENGTH} caracteres`, 400);
  }

  return {
    rating: parsedRating,
    title: title?.trim() || null,
    content: content.trim()
  };
};

const isOwner = (review, user) => review.auth_id === user.authId;

const isWithinEditWindow = (review) => {
  const elapsedMinutes = (Date.now() - new Date(review.created_at).getTime()) / (1000 * 60);

  return elapsedMinutes <= REVIEW_EDIT_LIMIT_MINUTES;
};

const canEditReview = (review, user) => {
  return isOwner(review, user) && isWithinEditWindow(review);
};

const getExistingReview = async (reviewId) => {
  const review = await reviewsRepository.findById(parseId(reviewId, "reviewId"));

  if (!review) {
    throw createError("Reseña no encontrada", 404);
  }

  return review;
};

// Una referencia ya usada por otras reseñas se considera validada;
// solo la primera reseña de un videojuego se confirma contra ms-games.
const ensureGameExists = async ({ igdbId, token }) => {
  const knownReviews = await reviewsRepository.countByGameId(igdbId);

  if (knownReviews > 0) {
    return;
  }

  await gamesClient.assertGameExists({ igdbId, token });
};

const createReview = async ({ igdbId, rating, title, content }, user, { token } = {}) => {
  const parsedIgdbId = parseId(igdbId, "igdbId");
  const data = validateReviewData({ rating, title, content });

  const existing = await reviewsRepository.findByUserAndGame({
    authId: user.authId,
    igdbId: parsedIgdbId
  });

  if (existing) {
    throw createError("Ya tienes una reseña para este videojuego", 409);
  }

  await ensureGameExists({ igdbId: parsedIgdbId, token });

  try {
    const review = await reviewsRepository.createReview({
      authId: user.authId,
      igdbId: parsedIgdbId,
      ...data
    });

    events.publishReviewCreated({ review });

    return review;
  } catch (error) {
    if (error.code === "23505") {
      throw createError("Ya tienes una reseña para este videojuego", 409);
    }

    throw error;
  }
};

const getReviewsByGame = async (igdbId, paginationQuery, user = null) => {
  const parsedIgdbId = parseId(igdbId, "igdbId");
  const paginationParams = getPaginationParams(paginationQuery);

  const [summary, reviews] = await Promise.all([
    reviewsRepository.getGameRatingSummary(parsedIgdbId),
    reviewsRepository.findByGameId(parsedIgdbId, paginationParams, user?.authId || null)
  ]);

  return {
    reviews,
    summary: {
      totalReviews: summary.total_reviews,
      averageRating: summary.average_rating
    },
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total: summary.total_reviews
    })
  };
};

const getReviewsByUser = async (authId, paginationQuery) => {
  if (!authId || !authId.trim()) {
    throw createError("El authId es obligatorio", 400);
  }

  const paginationParams = getPaginationParams(paginationQuery);
  const total = await reviewsRepository.countByUser(authId);
  const reviews = await reviewsRepository.findByUser(authId, paginationParams);

  return {
    reviews,
    pagination: buildPaginationMeta({
      page: paginationParams.page,
      limit: paginationParams.limit,
      total
    })
  };
};

const getReviewById = async (reviewId) => {
  return getExistingReview(reviewId);
};

const getUserReviewsSummary = async (authId) => {
  if (!authId || !authId.trim()) {
    throw createError("El authId es obligatorio", 400);
  }

  const [reviewsCount, totalLikesReceived] = await Promise.all([
    reviewsRepository.countByUser(authId),
    reviewsRepository.countLikesReceivedByUser(authId)
  ]);

  return { authId, reviewsCount, totalLikesReceived };
};

const updateReview = async (reviewId, { rating, title, content }, user) => {
  const review = await getExistingReview(reviewId);

  if (!isOwner(review, user)) {
    throw createError("Solo el autor puede editar su reseña", 403);
  }

  if (!isWithinEditWindow(review)) {
    throw createError(
      `Solo puedes editar tu reseña durante los primeros ${REVIEW_EDIT_LIMIT_MINUTES} minutos`,
      403
    );
  }

  const data = validateReviewData({ rating, title, content });

  return reviewsRepository.updateReview({ reviewId: review.id, ...data });
};

const deleteReview = async (reviewId, user) => {
  const review = await getExistingReview(reviewId);

  if (!isOwner(review, user) && user.role !== "ADMIN") {
    throw createError("No tienes permisos para eliminar esta reseña", 403);
  }

  await reviewsRepository.deleteReview(review.id);

  events.publishReviewDeleted({ review, actorAuthId: user.authId });

  return { message: "Reseña eliminada correctamente" };
};

const removeReviewImage = async (reviewId, user) => {
  const review = await getExistingReview(reviewId);

  if (!isOwner(review, user) && user.role !== "ADMIN") {
    throw createError("No tienes permisos para quitar esta imagen", 403);
  }

  const updatedReview = await reviewsRepository.updateReviewImage({
    reviewId: review.id,
    imageUrl: null
  });

  return { reviewId: review.id, imageUrl: null, review: updatedReview };
};

const likeReview = async (reviewId, user) => {
  const review = await getExistingReview(reviewId);

  const like = await reviewsRepository.likeReview({
    reviewId: review.id,
    authId: user.authId
  });

  if (!like) {
    return { message: "Ya habías dado like a esta reseña" };
  }

  events.publishReviewLiked({ review, actorAuthId: user.authId });

  return { message: "Like agregado correctamente" };
};

const unlikeReview = async (reviewId, user) => {
  const removedLike = await reviewsRepository.unlikeReview({
    reviewId: parseId(reviewId, "reviewId"),
    authId: user.authId
  });

  if (!removedLike) {
    throw createError("No habías dado like a esta reseña", 404);
  }

  return { message: "Like eliminado correctamente" };
};

const getReviewLikes = async (reviewId) => {
  const review = await getExistingReview(reviewId);
  const likesCount = await reviewsRepository.countLikes(review.id);

  return { reviewId: review.id, likesCount };
};

module.exports = {
  canEditReview,
  createReview,
  getReviewsByGame,
  getReviewsByUser,
  getReviewById,
  getUserReviewsSummary,
  updateReview,
  deleteReview,
  removeReviewImage,
  likeReview,
  unlikeReview,
  getReviewLikes
};
