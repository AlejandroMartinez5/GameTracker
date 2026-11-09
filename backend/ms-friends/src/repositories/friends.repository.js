const { pool } = require("../config/db");

const createRequest = async ({ requesterAuthId, receiverAuthId }) => {
  const query = `
    INSERT INTO friend_requests (requester_auth_id, receiver_auth_id)
    VALUES ($1, $2)
    RETURNING *
  `;

  const result = await pool.query(query, [requesterAuthId, receiverAuthId]);
  return result.rows[0];
};