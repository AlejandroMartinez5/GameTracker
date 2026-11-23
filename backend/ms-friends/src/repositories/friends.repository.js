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

const findActiveBetweenUsers = async (authIdA, authIdB) => {
  const query = `
    SELECT *
    FROM friend_requests
    WHERE status IN ('PENDING', 'ACCEPTED')
      AND (
        (requester_auth_id = $1 AND receiver_auth_id = $2)
        OR (requester_auth_id = $2 AND receiver_auth_id = $1)
      )
    LIMIT 1
  `;

  const result = await pool.query(query, [authIdA, authIdB]);
  return result.rows[0] || null;
};

const findById = async (requestId) => {
  const query = `
    SELECT *
    FROM friend_requests
    WHERE id = $1
  `;

  const result = await pool.query(query, [requestId]);
  return result.rows[0] || null;
};

const updateStatus = async ({ requestId, status, receiverAuthId }) => {
  const query = `
    UPDATE friend_requests
    SET status = $1,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
       AND status = 'PENDING'
       AND receiver_auth_id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [status, requestId, receiverAuthId]);
  return result.rows[0] || null;
};

const deleteAcceptedBetweenUsers = async (authIdA, authIdB) => {
  const query = `
    DELETE FROM friend_requests
    WHERE status = 'ACCEPTED'
      AND (
        (requester_auth_id = $1 AND receiver_auth_id = $2)
        OR (requester_auth_id = $2 AND receiver_auth_id = $1)
      )
    RETURNING *
  `;

  const result = await pool.query(query, [authIdA, authIdB]);
  return result.rows[0] || null;
};

const deletePendingRequestById = async (requestId) => {
  const query = `
    DELETE FROM friend_requests
    WHERE id = $1 AND status = 'PENDING'
    RETURNING *
  `;

  const result = await pool.query(query, [requestId]);
  return result.rows[0] || null;
};

const countFriends = async (authId) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM friend_requests
    WHERE status = 'ACCEPTED'
      AND (requester_auth_id = $1 OR receiver_auth_id = $1)
  `;

  const result = await pool.query(query, [authId]);
  return Number(result.rows[0].total);
};

const findFriends = async (authId, { limit, offset }) => {
  const query = `
    SELECT
      id,
      requester_auth_id,
      receiver_auth_id,
      CASE
        WHEN requester_auth_id = $1 THEN receiver_auth_id
        ELSE requester_auth_id
      END AS friend_auth_id,
      created_at,
      updated_at
    FROM friend_requests
    WHERE status = 'ACCEPTED'
      AND (requester_auth_id = $1 OR receiver_auth_id = $1)
    ORDER BY updated_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [authId, limit, offset]);
  return result.rows;
};

const getFriendsSummary = async (authId) => {
  const query = `
    SELECT COUNT(*) AS friends_count
    FROM friend_requests
    WHERE status = 'ACCEPTED'
      AND (requester_auth_id = $1 OR receiver_auth_id = $1)
  `;

  const result = await pool.query(query, [authId]);

  return {
    authId,
    friendsCount: Number(result.rows[0].friends_count)
  };
};

const countIncomingRequests = async (authId) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM friend_requests
    WHERE receiver_auth_id = $1 AND status = 'PENDING'
  `;

  const result = await pool.query(query, [authId]);
  return Number(result.rows[0].total);
};

const findIncomingRequests = async (authId, { limit, offset }) => {
  const query = `
    SELECT *
    FROM friend_requests
    WHERE receiver_auth_id = $1 AND status = 'PENDING'
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [authId, limit, offset]);
  return result.rows;
};

const countOutgoingRequests = async (authId) => {
  const query = `
    SELECT COUNT(*) AS total
    FROM friend_requests
    WHERE requester_auth_id = $1 AND status = 'PENDING'
  `;

  const result = await pool.query(query, [authId]);
  return Number(result.rows[0].total);
};

const findOutgoingRequests = async (authId, { limit, offset }) => {
  const query = `
    SELECT *
    FROM friend_requests
    WHERE requester_auth_id = $1 AND status = 'PENDING'
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [authId, limit, offset]);
  return result.rows;
};

const getAdminStats = async () => {
  const result = await pool.query(`
    WITH accepted_users AS (
      SELECT requester_auth_id AS auth_id
      FROM friend_requests
      WHERE status = 'ACCEPTED'
      UNION
      SELECT receiver_auth_id AS auth_id
      FROM friend_requests
      WHERE status = 'ACCEPTED'
    )
    SELECT
      (SELECT COUNT(*) FROM friend_requests)::int AS total_requests,
      (SELECT COUNT(*) FROM friend_requests WHERE status = 'PENDING')::int AS pending_requests,
      (SELECT COUNT(*) FROM friend_requests WHERE status = 'ACCEPTED')::int AS accepted_friendships,
      (SELECT COUNT(*) FROM friend_requests WHERE status = 'REJECTED')::int AS rejected_requests,
      (SELECT COUNT(*) FROM accepted_users)::int AS users_with_friendships
  `);

  const row = result.rows[0];

  return {
    totalRequests: row.total_requests,
    pendingRequests: row.pending_requests,
    acceptedFriendships: row.accepted_friendships,
    rejectedRequests: row.rejected_requests,
    usersWithFriendships: row.users_with_friendships
  };
};

module.exports = {
  createRequest,
  findActiveBetweenUsers,
  findById,
  updateStatus,
  deleteAcceptedBetweenUsers,
  deletePendingRequestById,
  countFriends,
  findFriends,
  getFriendsSummary,
  countIncomingRequests,
  findIncomingRequests,
  countOutgoingRequests,
  findOutgoingRequests,
  getAdminStats
};
