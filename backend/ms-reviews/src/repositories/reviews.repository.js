const { pool } = require("../config/db");

const createReview = async ({ authId, igdbId, rating, title, content, imageUrl = null }) => {
  const query = `
    INSERT INTO reviews (auth_id, igdb_id, rating, title, content, image_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await pool.query(query, [authId, igdbId, rating, title, content, imageUrl]);
  return result.rows[0];
};

const findById = async (reviewId) => {
  const query = `
    SELECT *
    FROM reviews
    WHERE id = $1
  `;

  const result = await pool.query(query, [reviewId]);
  return result.rows[0] || null;
};

const findByUserAndGame = async ({ authId, igdbId }) => {
  const query = `
    SELECT *
    FROM reviews
    WHERE auth_id = $1 AND igdb_id = $2
  `;

  const result = await pool.query(query, [authId, igdbId]);
  return result.rows[0] || null;
};

const findByGameId = async (igdbId, { limit, offset }, authId = null) => {
  const query = `
    WITH paginated_reviews AS (
      SELECT *
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
    SELECT *
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
  return result.rows[0] || null;
};

const deleteReview = async (reviewId) => {
  const query = `
    DELETE FROM reviews
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [reviewId]);
  return result.rows[0] || null;
};

const updateReviewImage = async ({ reviewId, imageUrl }) => {
  const query = `
    UPDATE reviews
    SET
      image_url = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [imageUrl, reviewId]);
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
    DELETE FROM review_likes
    WHERE review_id = $1 AND auth_id = $2
    RETURNING *
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
  likeReview,
  unlikeReview,
  countLikes
};
