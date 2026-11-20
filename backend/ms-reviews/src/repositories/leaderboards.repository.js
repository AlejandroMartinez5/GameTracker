const { pool } = require("../config/db");

const TOP_LIMIT = 30;

const getTopUsers = async (periodStart, currentAuthId = null) => {
  const query = `
    WITH user_likes AS (
      SELECT
        r.auth_id,
        COUNT(*)::INTEGER AS review_likes,
        0::INTEGER AS comment_likes
      FROM review_likes rl
      INNER JOIN reviews r ON r.id = rl.review_id
      WHERE ($1::timestamp IS NULL OR rl.created_at >= $1::timestamp)
      GROUP BY r.auth_id

      UNION ALL

      SELECT
        c.auth_id,
        0::INTEGER AS review_likes,
        COUNT(*)::INTEGER AS comment_likes
      FROM comment_likes cl
      INNER JOIN comments c ON c.id = cl.comment_id
      WHERE ($1::timestamp IS NULL OR cl.created_at >= $1::timestamp)
      GROUP BY c.auth_id
    ),
    totals AS (
      SELECT
        auth_id,
        SUM(review_likes)::INTEGER AS review_likes,
        SUM(comment_likes)::INTEGER AS comment_likes,
        (SUM(review_likes) + SUM(comment_likes))::INTEGER AS total_likes
      FROM user_likes
      GROUP BY auth_id
    ),
    ranked AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY total_likes DESC, review_likes DESC, comment_likes DESC, auth_id ASC
        )::INTEGER AS rank,
        auth_id,
        total_likes,
        review_likes,
        comment_likes
      FROM totals
    )
    SELECT *
    FROM ranked
    WHERE rank <= $2 OR ($3::varchar IS NOT NULL AND auth_id = $3)
    ORDER BY rank ASC
  `;

  const result = await pool.query(query, [periodStart, TOP_LIMIT, currentAuthId]);
  return result.rows;
};

const getTopReviews = async (periodStart, currentAuthId = null) => {
  const query = `
    WITH totals AS (
      SELECT
        r.id AS review_id,
        r.auth_id,
        r.igdb_id,
        r.rating,
        r.title,
        r.content,
        r.image_url,
        r.created_at,
        COUNT(rl.id)::INTEGER AS likes_count
      FROM reviews r
      INNER JOIN review_likes rl ON rl.review_id = r.id
      WHERE ($1::timestamp IS NULL OR rl.created_at >= $1::timestamp)
      GROUP BY r.id
    ),
    ranked AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY likes_count DESC, created_at DESC, review_id ASC
        )::INTEGER AS rank,
        *
      FROM totals
    ),
    top_rows AS (
      SELECT *
      FROM ranked
      WHERE rank <= $2
    ),
    current_user_row AS (
      SELECT *
      FROM ranked
      WHERE $3::varchar IS NOT NULL AND auth_id = $3
      ORDER BY rank ASC
      LIMIT 1
    )
    SELECT *
    FROM top_rows

    UNION ALL

    SELECT current_user_row.*
    FROM current_user_row
    WHERE NOT EXISTS (
      SELECT 1
      FROM top_rows
      WHERE top_rows.review_id = current_user_row.review_id
    )
    ORDER BY rank ASC
  `;

  const result = await pool.query(query, [periodStart, TOP_LIMIT, currentAuthId]);
  return result.rows;
};

const getTopComments = async (periodStart, currentAuthId = null) => {
  const query = `
    WITH totals AS (
      SELECT
        c.id AS comment_id,
        c.review_id,
        c.auth_id,
        c.content,
        c.image_url,
        c.created_at,
        COUNT(cl.id)::INTEGER AS likes_count
      FROM comments c
      INNER JOIN comment_likes cl ON cl.comment_id = c.id
      WHERE ($1::timestamp IS NULL OR cl.created_at >= $1::timestamp)
      GROUP BY c.id
    ),
    ranked AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY likes_count DESC, created_at DESC, comment_id ASC
        )::INTEGER AS rank,
        *
      FROM totals
    ),
    top_rows AS (
      SELECT *
      FROM ranked
      WHERE rank <= $2
    ),
    current_user_row AS (
      SELECT *
      FROM ranked
      WHERE $3::varchar IS NOT NULL AND auth_id = $3
      ORDER BY rank ASC
      LIMIT 1
    )
    SELECT *
    FROM top_rows

    UNION ALL

    SELECT current_user_row.*
    FROM current_user_row
    WHERE NOT EXISTS (
      SELECT 1
      FROM top_rows
      WHERE top_rows.comment_id = current_user_row.comment_id
    )
    ORDER BY rank ASC
  `;

  const result = await pool.query(query, [periodStart, TOP_LIMIT, currentAuthId]);
  return result.rows;
};

module.exports = {
  TOP_LIMIT,
  getTopUsers,
  getTopReviews,
  getTopComments
};
