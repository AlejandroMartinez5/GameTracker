const { requestService } = require('./http.client');
const requestReviewsService = (options) => requestService({ baseUrl: process.env.REVIEWS_SERVICE_URL || 'http://localhost:3005/api', ...options });

const getReview = async ({ reviewId, token }) => {
  const data = await requestReviewsService({
    path: `/reviews/${encodeURIComponent(reviewId)}`,
    method: "GET",
    token
  });

  return data.review || data;
};

const getComment = async ({ commentId, token }) => {
  const data = await requestReviewsService({
    path: `/comments/${encodeURIComponent(commentId)}`,
    method: "GET",
    token
  });

  return data.comment || data;
};

const deleteReview = async ({ reviewId, token }) => {
  return requestReviewsService({
    path: `/reviews/${encodeURIComponent(reviewId)}`,
    method: "DELETE",
    token
  });
};

const deleteComment = async ({ commentId, token }) => {
  return requestReviewsService({
    path: `/comments/${encodeURIComponent(commentId)}`,
    method: "DELETE",
    token
  });
};

const removeReviewImage = async ({ reviewId, token }) => {
  return requestReviewsService({
    path: `/reviews/${encodeURIComponent(reviewId)}/image`,
    method: "DELETE",
    token
  });
};

const removeCommentImage = async ({ commentId, token }) => {
  return requestReviewsService({
    path: `/comments/${encodeURIComponent(commentId)}/image`,
    method: "DELETE",
    token
  });
};

module.exports = {
  getReview,
  getComment,
  deleteReview,
  deleteComment,
  removeReviewImage,
  removeCommentImage
};
