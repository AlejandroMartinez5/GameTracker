const { pool } = require("../config/db");

const createComment = async ({ reviewId, authId, content, imageUrl = null }) => {
  const query = `
    INSERT INTO comments (review_id, auth_id, content, image_url)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const result = await pool.query(query, [reviewId, authId, content, imageUrl]);
  return result.rows[0];
};

const findByReviewId = async (reviewId, { limit, offset }, authId = null) => {
  const query = `
    WITH paginated_comments AS (
      SELECT *
      FROM comments
      WHERE review_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    )
    SELECT
      c.*,
      COALESCE(cl.likes_count, 0)::int AS likes_count,
      EXISTS (
        SELECT 1
        FROM comment_likes user_like
        WHERE user_like.comment_id = c.id
          AND user_like.auth_id = $4
      ) AS liked_by_me
    FROM paginated_comments c
    LEFT JOIN (
      SELECT comment_id, COUNT(*) AS likes_count
      FROM comment_likes
      GROUP BY comment_id
    ) cl ON c.id = cl.comment_id
    ORDER BY c.created_at ASC
  `;

  const result = await pool.query(query, [reviewId, limit, offset, authId]);
  return result.rows;
};

const countByReviewId = async (reviewId) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM comments
    WHERE review_id = $1
  `;

  const result = await pool.query(query, [reviewId]);
  return Number(result.rows[0].total);
};

const findImageUrlsByReviewId = async (reviewId) => {
  const query = `
    SELECT image_url
    FROM comments
    WHERE review_id = $1
      AND image_url IS NOT NULL
  `;

  const result = await pool.query(query, [reviewId]);
  return result.rows.map((row) => row.image_url);
};

const findById = async (commentId) => {
  const query = `
    SELECT *
    FROM comments
    WHERE id = $1
  `;

  const result = await pool.query(query, [commentId]);
  return result.rows[0] || null;
};

const updateComment = async ({ commentId, content }) => {
  const query = `
    UPDATE comments
    SET
      content = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [content, commentId]);
  return result.rows[0] || null;
};

const deleteComment = async (commentId) => {
  const query = `
    DELETE FROM comments
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [commentId]);
  return result.rows[0] || null;
};

const updateCommentImage = async ({ commentId, imageUrl }) => {
  const query = `
    UPDATE comments
    SET
      image_url = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [imageUrl, commentId]);
  return result.rows[0] || null;
};

const likeComment = async ({ commentId, authId }) => {
  const query = `
    INSERT INTO comment_likes (comment_id, auth_id)
    VALUES ($1, $2)
    ON CONFLICT (comment_id, auth_id) DO NOTHING
    RETURNING *
  `;

  const result = await pool.query(query, [commentId, authId]);
  return result.rows[0] || null;
};

const unlikeComment = async ({ commentId, authId }) => {
  const query = `
    DELETE FROM comment_likes
    WHERE comment_id = $1 AND auth_id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [commentId, authId]);
  return result.rows[0] || null;
};

const countLikes = async (commentId) => {
  const query = `
    SELECT COUNT(*) AS likes_count
    FROM comment_likes
    WHERE comment_id = $1
  `;

  const result = await pool.query(query, [commentId]);
  return Number(result.rows[0].likes_count);
};

module.exports = {
  createComment,
  findByReviewId,
  countByReviewId,
  findImageUrlsByReviewId,
  findById,
  updateComment,
  deleteComment,
  updateCommentImage,
  likeComment,
  unlikeComment,
  countLikes
};
