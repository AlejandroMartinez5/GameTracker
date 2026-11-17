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

module.exports = {
  create,
  find,
  getByUser,
  countByUser,
  remove
};
