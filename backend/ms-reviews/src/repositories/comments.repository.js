const { pool } = require("../config/db");

const createComment = async ({ reviewId, authId, content, image = null }) => {
  const query = `
    INSERT INTO comments (
      review_id, auth_id, content,
      image_data, image_mime_type, image_size
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await pool.query(query, [
    reviewId,
    authId,
    content,
    image?.data || null,
    image?.mimeType || null,
    image?.size || null
  ]);

  if (!image) {
    return toPublicComment(result.rows[0]);
  }

  const imageUrl = `/api/comments/${result.rows[0].id}/image`;
  const updated = await pool.query(
    `UPDATE comments SET image_url = $1 WHERE id = $2 RETURNING *`,
    [imageUrl, result.rows[0].id]
  );

  return toPublicComment(updated.rows[0]);
};

const commentFields = `
  id, review_id, auth_id, content,
  CASE
    WHEN image_data IS NOT NULL THEN '/api/comments/' || id || '/image'
    ELSE image_url
  END AS image_url,
  image_mime_type, image_size,
  (image_data IS NOT NULL) AS has_image,
  created_at, updated_at
`;

const toPublicComment = (comment) => {
  if (!comment) {
    return comment;
  }

  const { image_data: imageData, ...publicComment } = comment;

  return {
    ...publicComment,
    image_url: imageData
      ? `/api/comments/${comment.id}/image`
      : publicComment.image_url,
    has_image: Boolean(imageData) || Boolean(publicComment.has_image)
  };
};

const findByReviewId = async (reviewId, { limit, offset }, authId = null) => {
  const query = `
    WITH paginated_comments AS (
      SELECT ${commentFields}
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
    SELECT ${commentFields}
    FROM comments
    WHERE id = $1
  `;

  const result = await pool.query(query, [commentId]);
  return toPublicComment(result.rows[0]);
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
  return toPublicComment(result.rows[0]);
};

const deleteComment = async (commentId) => {
  const query = `
    DELETE FROM comments
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [commentId]);
  return toPublicComment(result.rows[0]);
};

const updateCommentImage = async ({ commentId, imageUrl }) => {
  const query = `
    UPDATE comments
    SET
      image_url = $1,
      image_data = NULL,
      image_mime_type = NULL,
      image_size = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [imageUrl, commentId]);
  return toPublicComment(result.rows[0]);
};

const updateCommentImageData = async ({ commentId, image }) => {
  const query = `
    UPDATE comments
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
    `/api/comments/${commentId}/image`,
    image.data,
    image.mimeType,
    image.size,
    commentId
  ]);

  return toPublicComment(result.rows[0]);
};

const getCommentImage = async (commentId) => {
  const result = await pool.query(
    `SELECT image_data, image_mime_type, image_size
     FROM comments
     WHERE id = $1 AND image_data IS NOT NULL`,
    [commentId]
  );

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
    DELETE FROM comment_likes AS likes
    USING comments AS comment
    WHERE likes.comment_id = $1
      AND likes.auth_id = $2
      AND comment.id = likes.comment_id
    RETURNING likes.*, comment.auth_id AS owner_auth_id
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
  updateCommentImageData,
  getCommentImage,
  likeComment,
  unlikeComment,
  countLikes
};
