const { pool } = require("../config/db");

const create = async ({ recipientAuthId, actorAuthId = null, type, title, body, metadata = {} }) => {
  const result = await pool.query(
    `INSERT INTO notifications (recipient_auth_id, actor_auth_id, type, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [recipientAuthId, actorAuthId, type, title, body, JSON.stringify(metadata)]
  );
  return result.rows[0];
};

const buildConditions = (authId, filters) => {
  const values = [authId];
  const conditions = ["recipient_auth_id = $1"];
  if (filters.status === "unread") conditions.push("read_at IS NULL");
  if (filters.status === "read") conditions.push("read_at IS NOT NULL");
  if (filters.type) {
    values.push(filters.type);
    conditions.push(`type = $${values.length}`);
  }
  return { values, conditions };
};

const countByRecipient = async (authId, filters) => {
  const { values, conditions } = buildConditions(authId, filters);
  const result = await pool.query(`SELECT COUNT(*) AS total FROM notifications WHERE ${conditions.join(" AND ")}`, values);
  return Number(result.rows[0].total);
};

const findByRecipient = async (authId, filters, { limit, offset }) => {
  const { values, conditions } = buildConditions(authId, filters);
  values.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM notifications WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
};

const countUnread = async (authId) => {
  const result = await pool.query("SELECT COUNT(*) AS total FROM notifications WHERE recipient_auth_id = $1 AND read_at IS NULL", [authId]);
  return Number(result.rows[0].total);
};

const markAsRead = async (id, authId) => {
  const result = await pool.query(
    "UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = $1 AND recipient_auth_id = $2 RETURNING *",
    [id, authId]
  );
  return result.rows[0] || null;
};

const markAllAsRead = async (authId) => {
  const result = await pool.query(
    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE recipient_auth_id = $1 AND read_at IS NULL RETURNING *",
    [authId]
  );
  return result.rows;
};

const remove = async (id, authId) => {
  const result = await pool.query("DELETE FROM notifications WHERE id = $1 AND recipient_auth_id = $2 RETURNING *", [id, authId]);
  return result.rows[0] || null;
};

const deleteOlderThanDays = async (days) => {
  const result = await pool.query("DELETE FROM notifications WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')", [days]);
  return result.rowCount;
};

module.exports = { create, countByRecipient, findByRecipient, countUnread, markAsRead, markAllAsRead, remove, deleteOlderThanDays };

