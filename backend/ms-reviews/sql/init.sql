CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  auth_id VARCHAR(255) NOT NULL,
  igdb_id INTEGER NOT NULL CHECK (igdb_id > 0),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(150),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (auth_id, igdb_id)
);

CREATE TABLE IF NOT EXISTS review_likes (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  auth_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (review_id, auth_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  auth_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  auth_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comment_id, auth_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_igdb_created
ON reviews (igdb_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_auth_created
ON reviews (auth_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_review_created
ON comments (review_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_review_likes_created_review
ON review_likes (created_at DESC, review_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_created_comment
ON comment_likes (created_at DESC, comment_id);
