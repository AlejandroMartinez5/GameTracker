const { pool } = require("../config/db");

const create = async (authId, igdbId) => {
  const result = await pool.query(
    `INSERT INTO favorites (auth_id, igdb_id)
     VALUES ($1, $2)
     RETURNING id, auth_id, igdb_id, created_at`,
    [authId, igdbId]
  );

  return result.rows[0];
};

const find = async (authId, igdbId) => {
  const result = await pool.query(
    `SELECT id, auth_id, igdb_id, created_at
     FROM favorites
     WHERE auth_id = $1 AND igdb_id = $2
     LIMIT 1`,
    [authId, igdbId]
  );

  return result.rows[0] || null;
};

const getByUser = async (authId, { limit, offset }) => {
  const result = await pool.query(
    `SELECT id, auth_id, igdb_id, created_at
     FROM favorites
     WHERE auth_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [authId, limit, offset]
  );

  return result.rows;
};

const countByUser = async (authId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS total FROM favorites WHERE auth_id = $1`,
    [authId]
  );

  return Number(result.rows[0].total);
};

const remove = async (authId, igdbId) => {
  const result = await pool.query(
    `DELETE FROM favorites
     WHERE auth_id = $1 AND igdb_id = $2
     RETURNING id, auth_id, igdb_id, created_at`,
    [authId, igdbId]
  );

  return result.rows[0] || null;
};

const getAdminStats = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total_favorites,
      COUNT(DISTINCT auth_id)::int AS users_with_favorites,
      COUNT(DISTINCT igdb_id)::int AS games_in_favorites,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS favorites_today,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::int AS favorites_last_30_days
    FROM favorites
  `);

  const row = result.rows[0];

  return {
    totalFavorites: row.total_favorites,
    usersWithFavorites: row.users_with_favorites,
    gamesInFavorites: row.games_in_favorites,
    favoritesToday: row.favorites_today,
    favoritesLast30Days: row.favorites_last_30_days
  };
};

module.exports = {
  create,
  find,
  getByUser,
  countByUser,
  remove,
  getAdminStats
};
