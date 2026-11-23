CREATE TABLE IF NOT EXISTS achievement_definitions (
  code VARCHAR(100) PRIMARY KEY,
  category VARCHAR(40) NOT NULL,
  metric VARCHAR(40) NOT NULL,
  threshold INTEGER,
  duration_seconds INTEGER,
  name VARCHAR(140) NOT NULL,
  description VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS achievement_users (
  auth_id VARCHAR(255) PRIMARY KEY,
  reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  friendships_count INTEGER NOT NULL DEFAULT 0 CHECK (friendships_count >= 0),
  registered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
  auth_id VARCHAR(255) NOT NULL,
  achievement_code VARCHAR(100) NOT NULL REFERENCES achievement_definitions(code),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (auth_id, achievement_code)
);

CREATE TABLE IF NOT EXISTS achievement_processed_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_auth_id
ON user_achievements (auth_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_achievement_users_registered_at
ON achievement_users (registered_at)
WHERE registered_at IS NOT NULL;

INSERT INTO achievement_definitions
  (code, category, metric, threshold, duration_seconds, name, description, sort_order)
VALUES
  ('reviews_1', 'reviews', 'reviews', 1, NULL, 'Primera reseña', 'Publica tu primera reseña.', 10),
  ('reviews_5', 'reviews', 'reviews', 5, NULL, 'Crítico habitual', 'Publica 5 reseñas.', 20),
  ('reviews_10', 'reviews', 'reviews', 10, NULL, 'Voz de la comunidad', 'Publica 10 reseñas.', 30),
  ('reviews_50', 'reviews', 'reviews', 50, NULL, 'Experto en videojuegos', 'Publica 50 reseñas.', 40),
  ('reviews_100', 'reviews', 'reviews', 100, NULL, 'Leyenda de las reseñas', 'Publica 100 reseñas.', 50),
  ('comments_1', 'comments', 'comments', 1, NULL, 'Primer comentario', 'Publica tu primer comentario.', 110),
  ('comments_5', 'comments', 'comments', 5, NULL, 'Conversador', 'Publica 5 comentarios.', 120),
  ('comments_10', 'comments', 'comments', 10, NULL, 'Participante activo', 'Publica 10 comentarios.', 130),
  ('comments_50', 'comments', 'comments', 50, NULL, 'Comentarista experto', 'Publica 50 comentarios.', 140),
  ('comments_100', 'comments', 'comments', 100, NULL, 'Voz incansable', 'Publica 100 comentarios.', 150),
  ('likes_1', 'likes', 'likes', 1, NULL, 'Primer reconocimiento', 'Recibe tu primer like.', 210),
  ('likes_5', 'likes', 'likes', 5, NULL, 'Apreciado', 'Recibe 5 likes.', 220),
  ('likes_10', 'likes', 'likes', 10, NULL, 'Popular', 'Recibe 10 likes.', 230),
  ('likes_50', 'likes', 'likes', 50, NULL, 'Muy valorado', 'Recibe 50 likes.', 240),
  ('likes_100', 'likes', 'likes', 100, NULL, 'Influente', 'Recibe 100 likes.', 250),
  ('likes_1000', 'likes', 'likes', 1000, NULL, 'Ídolo de la comunidad', 'Recibe 1000 likes.', 260),
  ('friendships_1', 'friendships', 'friendships', 1, NULL, 'Primera amistad', 'Consigue tu primera amistad aceptada.', 310),
  ('friendships_5', 'friendships', 'friendships', 5, NULL, 'Bien relacionado', 'Consigue 5 amistades aceptadas.', 320),
  ('friendships_10', 'friendships', 'friendships', 10, NULL, 'Conocido', 'Consigue 10 amistades aceptadas.', 330),
  ('friendships_50', 'friendships', 'friendships', 50, NULL, 'Popular entre jugadores', 'Consigue 50 amistades aceptadas.', 340),
  ('friendships_100', 'friendships', 'friendships', 100, NULL, 'Referente social', 'Consigue 100 amistades aceptadas.', 350),
  ('friendships_1000', 'friendships', 'friendships', 1000, NULL, 'Centro de la comunidad', 'Consigue 1000 amistades aceptadas.', 360),
  ('account_age_1_week', 'account_age', 'account_age', NULL, 604800, 'Una semana en GameTracker', 'Mantén tu cuenta durante una semana.', 410),
  ('account_age_1_month', 'account_age', 'account_age', NULL, 2592000, 'Un mes en GameTracker', 'Mantén tu cuenta durante un mes.', 420),
  ('account_age_1_year', 'account_age', 'account_age', NULL, 31536000, 'Un año en GameTracker', 'Mantén tu cuenta durante un año.', 430)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  metric = EXCLUDED.metric,
  threshold = EXCLUDED.threshold,
  duration_seconds = EXCLUDED.duration_seconds,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
