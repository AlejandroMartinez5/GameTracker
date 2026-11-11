CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  requester_auth_id VARCHAR(255) NOT NULL,
  receiver_auth_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (requester_auth_id <> receiver_auth_id),
  CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_active_pair
ON friend_requests (
  LEAST(requester_auth_id, receiver_auth_id),
  GREATEST(requester_auth_id, receiver_auth_id)
)
WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_status
ON friend_requests (requester_auth_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status
ON friend_requests (receiver_auth_id, status, created_at DESC);
