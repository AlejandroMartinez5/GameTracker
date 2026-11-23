const { pool } = require("../config/db");

const createReview = async ({
  authId,
  igdbId,
  rating,
  title,
  content,
  image = null
}) => {
  const query = `
    INSERT INTO reviews (
      auth_id, igdb_id, rating, title, content,
      image_data, image_mime_type, image_size
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const result = await pool.query(query, [
    authId,
    igdbId,
    rating,
    title,
    content,
    image?.data || null,
    image?.mimeType || null,
    image?.size || null
  ]);

  if (!image) {
    return toPublicReview(result.rows[0]);
  }

  const imageUrl = `/api/reviews/${result.rows[0].id}/image`;
  const updated = await pool.query(
    `UPDATE reviews SET image_url = $1 WHERE id = $2 RETURNING *`,
    [imageUrl, result.rows[0].id]
  );

  return toPublicReview(updated.rows[0]);
};

const reviewFields = `
  id, auth_id, igdb_id, rating, title, content,
  CASE
    WHEN image_data IS NOT NULL THEN '/api/reviews/' || id || '/image'
    ELSE image_url
  END AS image_url,
  image_mime_type, image_size,
  (image_data IS NOT NULL) AS has_image,
  created_at, updated_at
`;

const toPublicReview = (review) => {
  if (!review) {
    return review;
  }

  const { image_data: imageData, ...publicReview } = review;

  return {
    ...publicReview,
    image_url: imageData
      ? `/api/reviews/${review.id}/image`
      : publicReview.image_url,
    has_image: Boolean(imageData) || Boolean(publicReview.has_image)
  };
};

const findById = async (reviewId) => {
  const query = `
    SELECT ${reviewFields}
    FROM reviews
    WHERE id = $1
  `;

  const result = await pool.query(query, [reviewId]);
  return result.rows[0] || null;
};

const findByUserAndGame = async ({ authId, igdbId }) => {
  const query = `
    SELECT ${reviewFields}
    FROM reviews
    WHERE auth_id = $1 AND igdb_id = $2
  `;

  const result = await pool.query(query, [authId, igdbId]);
  return toPublicReview(result.rows[0]);
};

const findByGameId = async (igdbId, { limit, offset }, authId = null) => {
  const query = `
    WITH paginated_reviews AS (
      SELECT ${reviewFields}
      FROM reviews
      WHERE igdb_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    )
    SELECT
      r.*,
      COALESCE(rl.likes_count, 0)::int AS likes_count,
      COALESCE(c.comments_count, 0)::int AS comments_count,
      EXISTS (
        SELECT 1
        FROM review_likes user_like
        WHERE user_like.review_id = r.id
          AND user_like.auth_id = $4
      ) AS liked_by_me
    FROM paginated_reviews r
    LEFT JOIN (
      SELECT review_id, COUNT(*) AS likes_count
      FROM review_likes
      GROUP BY review_id
    ) rl ON r.id = rl.review_id
    LEFT JOIN (
      SELECT review_id, COUNT(*) AS comments_count
      FROM comments
      GROUP BY review_id
    ) c ON r.id = c.review_id
    ORDER BY r.created_at DESC
  `;

  const result = await pool.query(query, [igdbId, limit, offset, authId]);
  return result.rows;
};

const countByGameId = async (igdbId) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM reviews
    WHERE igdb_id = $1
  `;

  const result = await pool.query(query, [igdbId]);
  return Number(result.rows[0].total);
};

const getGameRatingSummary = async (igdbId) => {
  const query = `
    SELECT
      COUNT(*)::int AS total_reviews,
      COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float AS average_rating
    FROM reviews
    WHERE igdb_id = $1
  `;

  const result = await pool.query(query, [igdbId]);
  return result.rows[0];
};

const findByUser = async (authId, { limit, offset }) => {
  const query = `
    SELECT ${reviewFields}
    FROM reviews
    WHERE auth_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [authId, limit, offset]);
  return result.rows;
};

const countByUser = async (authId) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM reviews
    WHERE auth_id = $1
  `;

  const result = await pool.query(query, [authId]);
  return Number(result.rows[0].total);
};

const countLikesReceivedByUser = async (authId) => {
  const query = `
    SELECT COUNT(rl.id) AS total_likes
    FROM reviews r
    LEFT JOIN review_likes rl ON rl.review_id = r.id
    WHERE r.auth_id = $1
  `;

  const result = await pool.query(query, [authId]);
  return Number(result.rows[0].total_likes);
};

const updateReview = async ({ reviewId, rating, title, content }) => {
  const query = `
    UPDATE reviews
    SET
      rating = $1,
      title = $2,
      content = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [rating, title, content, reviewId]);
  return toPublicReview(result.rows[0]);
};

const deleteReview = async (reviewId) => {
  const query = `
    DELETE FROM reviews
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [reviewId]);
  return toPublicReview(result.rows[0]);
};

const updateReviewImage = async ({ reviewId, imageUrl }) => {
  const query = `
    UPDATE reviews
    SET
      image_url = $1,
      image_data = NULL,
      image_mime_type = NULL,
      image_size = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [imageUrl, reviewId]);
  return toPublicReview(result.rows[0]);
};

const updateReviewImageData = async ({ reviewId, image }) => {
  const query = `
    UPDATE reviews
    SET
      image_url = $1,
      image_data = $2,
      image_mime_type = $3,
      image_size = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [
    `/api/reviews/${reviewId}/image`,
    image.data,
    image.mimeType,
    image.size,
    reviewId
  ]);

  return toPublicReview(result.rows[0]);
};

const getReviewImage = async (reviewId) => {
  const result = await pool.query(
    `SELECT image_data, image_mime_type, image_size
     FROM reviews
     WHERE id = $1 AND image_data IS NOT NULL`,
    [reviewId]
  );

  return result.rows[0] || null;
};

const likeReview = async ({ reviewId, authId }) => {
  const query = `
    INSERT INTO review_likes (review_id, auth_id)
    VALUES ($1, $2)
    ON CONFLICT (review_id, auth_id) DO NOTHING
    RETURNING *
  `;

  const result = await pool.query(query, [reviewId, authId]);
  return result.rows[0] || null;
};

const unlikeReview = async ({ reviewId, authId }) => {
  const query = `
    DELETE FROM review_likes AS likes
    USING reviews AS review
    WHERE likes.review_id = $1
      AND likes.auth_id = $2
      AND review.id = likes.review_id
    RETURNING likes.*, review.auth_id AS owner_auth_id
  `;

  const result = await pool.query(query, [reviewId, authId]);
  return result.rows[0] || null;
};

const countLikes = async (reviewId) => {
  const query = `
    SELECT COUNT(*) AS likes_count
    FROM review_likes
    WHERE review_id = $1
  `;

  const result = await pool.query(query, [reviewId]);
  return Number(result.rows[0].likes_count);
};

const getAdminStats = async ({ days = 30, limit = 5 } = {}) => {
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const [totalsResult, reviewsPerDayResult, likesPerDayResult, topReviewsResult, topCommentsResult] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM reviews)::int AS total_reviews,
        (SELECT COUNT(*) FROM comments)::int AS total_comments,
        (SELECT COUNT(*) FROM review_likes)::int AS total_review_likes,
        (SELECT COUNT(*) FROM comment_likes)::int AS total_comment_likes,
        COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float AS average_rating
      FROM reviews
    `),
    pool.query(`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - (($1::int - 1) * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT days.day, COALESCE(COUNT(reviews.id), 0)::int AS count
      FROM days
      LEFT JOIN reviews ON DATE(reviews.created_at) = days.day
      GROUP BY days.day
      ORDER BY days.day ASC
    `, [safeDays]),
    pool.query(`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - (($1::int - 1) * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ), review_counts AS (
        SELECT DATE(created_at) AS day, COUNT(*)::int AS count
        FROM review_likes
        WHERE created_at >= CURRENT_DATE - (($1::int - 1) * INTERVAL '1 day')
        GROUP BY DATE(created_at)
      ), comment_counts AS (
        SELECT DATE(created_at) AS day, COUNT(*)::int AS count
        FROM comment_likes
        WHERE created_at >= CURRENT_DATE - (($1::int - 1) * INTERVAL '1 day')
        GROUP BY DATE(created_at)
      )
      SELECT days.day,
        COALESCE(review_counts.count, 0) AS review_likes,
        COALESCE(comment_counts.count, 0) AS comment_likes,
        COALESCE(review_counts.count, 0) + COALESCE(comment_counts.count, 0) AS total_likes
      FROM days
      LEFT JOIN review_counts ON review_counts.day = days.day
      LEFT JOIN comment_counts ON comment_counts.day = days.day
      ORDER BY days.day ASC
    `, [safeDays]),
    pool.query(`
      SELECT r.id, r.auth_id, r.igdb_id, r.rating, r.title, r.content,
        r.image_url, r.created_at, COUNT(rl.id)::int AS likes_count
      FROM reviews r
      LEFT JOIN review_likes rl ON rl.review_id = r.id
      GROUP BY r.id
      ORDER BY likes_count DESC, r.created_at DESC
      LIMIT $1
    `, [safeLimit]),
    pool.query(`
      SELECT c.id, c.review_id, c.auth_id, c.content, c.image_url,
        c.created_at, COUNT(cl.id)::int AS likes_count
      FROM comments c
      LEFT JOIN comment_likes cl ON cl.comment_id = c.id
      GROUP BY c.id
      ORDER BY likes_count DESC, c.created_at DESC
      LIMIT $1
    `, [safeLimit])
  ]);

  const totals = totalsResult.rows[0];
  const totalReviews = Number(totals.total_reviews);
  const totalComments = Number(totals.total_comments);
  const totalReviewLikes = Number(totals.total_review_likes);
  const totalCommentLikes = Number(totals.total_comment_likes);

  return {
    totals: {
      reviews: totalReviews,
      comments: totalComments,
      reviewLikes: totalReviewLikes,
      commentLikes: totalCommentLikes,
      likes: totalReviewLikes + totalCommentLikes,
      averageRating: Number(totals.average_rating)
    },
    reviewsPerDay: reviewsPerDayResult.rows,
    likesPerDay: likesPerDayResult.rows,
    topLikedContent: {
      reviews: topReviewsResult.rows,
      comments: topCommentsResult.rows
    },
    ratios: {
      reviewLikesPerReview: totalReviews > 0 ? Number((totalReviewLikes / totalReviews).toFixed(2)) : 0,
      commentLikesPerComment: totalComments > 0 ? Number((totalCommentLikes / totalComments).toFixed(2)) : 0
    },
    period: { days: safeDays }
  };
};

module.exports = {
  createReview,
  findById,
  findByUserAndGame,
  findByGameId,
  countByGameId,
  getGameRatingSummary,
  findByUser,
  countByUser,
  countLikesReceivedByUser,
  updateReview,
  deleteReview,
  updateReviewImage,
  updateReviewImageData,
  getReviewImage,
  likeReview,
  unlikeReview,
  countLikes,
  getAdminStats
};
