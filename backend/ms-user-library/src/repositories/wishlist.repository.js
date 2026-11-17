const { pool } = require("../config/db");

const add = async (authId, igdbId) => {
  const result = await pool.query(
    `INSERT INTO wishlist (auth_id, igdb_id)
     VALUES ($1, $2)
     RETURNING id, auth_id, igdb_id, created_at`,
    [authId, igdbId]
  );

  return result.rows[0];
};

const getByUser = async (authId, { limit, offset }) => {
  const result = await pool.query(
    `SELECT id, auth_id, igdb_id, created_at
     FROM wishlist
     WHERE auth_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [authId, limit, offset]
  );

  return result.rows;
};

const countByUser = async (authId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS total FROM wishlist WHERE auth_id = $1`,
    [authId]
  );

  return Number(result.rows[0].total);
};

const remove = async (authId, igdbId) => {
  const result = await pool.query(
    `DELETE FROM wishlist
     WHERE auth_id = $1 AND igdb_id = $2
     RETURNING id, auth_id, igdb_id, created_at`,
    [authId, igdbId]
  );

  return result.rows[0] || null;
};

const exists = async (authId, igdbId) => {
  const result = await pool.query(
    `SELECT 1 FROM wishlist WHERE auth_id = $1 AND igdb_id = $2`,
    [authId, igdbId]
  );

  return result.rowCount > 0;
};

module.exports = {
  add,
  getByUser,
  countByUser,
  remove,
  exists
};
