CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  auth_id VARCHAR(255) NOT NULL,
  igdb_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (auth_id, igdb_id),
  CHECK (igdb_id > 0)
);

CREATE INDEX IF NOT EXISTS idx_favorites_auth_id_created_at
  ON favorites (auth_id, created_at DESC);
