CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_auth_id VARCHAR(255) NOT NULL,
  actor_auth_id VARCHAR(255),
  type VARCHAR(80) NOT NULL,
  title VARCHAR(140) NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
ON notifications (recipient_auth_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
ON notifications (recipient_auth_id, created_at DESC)
WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_type
ON notifications (type);

