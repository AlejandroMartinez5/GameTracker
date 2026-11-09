const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_auth_id VARCHAR(255) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      reason VARCHAR(80) NOT NULL,
      description TEXT,
      target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      reviewed_by_auth_id VARCHAR(255),
      admin_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP NULL,
      CHECK (target_type IN ('USER', 'REVIEW', 'COMMENT')),
      CHECK (status IN ('PENDING', 'DISMISSED', 'ACTION_TAKEN')),
      CHECK (reason IN (
        'SPAM',
        'OFFENSIVE_CONTENT',
        'HARASSMENT',
        'HATE_SPEECH',
        'SEXUAL_CONTENT',
        'VIOLENCE',
        'SPOILER',
        'FAKE_PROFILE',
        'INAPPROPRIATE_IMAGE',
        'OTHER'
      ))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_pending_report
    ON reports (reporter_auth_id, target_type, target_id)
    WHERE status = 'PENDING';

    CREATE INDEX IF NOT EXISTS idx_reports_status_created
    ON reports (status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_reports_reporter_created
    ON reports (reporter_auth_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_reports_target
    ON reports (target_type, target_id);

    CREATE TABLE IF NOT EXISTS moderation_actions (
      id SERIAL PRIMARY KEY,
      report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
      admin_auth_id VARCHAR(255) NOT NULL,
      action_type VARCHAR(80) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      note TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CHECK (target_type IN ('USER', 'REVIEW', 'COMMENT')),
      CHECK (action_type IN (
        'DISMISS_REPORT',
        'SUSPEND_USER',
        'BAN_USER',
        'DELETE_REVIEW',
        'DELETE_COMMENT',
        'REMOVE_PROFILE_IMAGE',
        'REMOVE_REVIEW_IMAGE',
        'REMOVE_COMMENT_IMAGE'
      ))
    );

    CREATE INDEX IF NOT EXISTS idx_moderation_actions_report
    ON moderation_actions (report_id);

    CREATE INDEX IF NOT EXISTS idx_moderation_actions_target
    ON moderation_actions (target_type, target_id);
  `);

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  console.log("Tablas de moderacion verificadas/creadas");
};

const testConnection = async (retries = 10, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL conectado correctamente en ms-moderation");

      await createTables();
      return;
    } catch (error) {
      console.error(
        `Intento ${attempt}/${retries} fallido conectando a PostgreSQL: ${error.message}`
      );

      if (attempt === retries) {
        throw error;
      }

      await wait(delay);
    }
  }
};

module.exports = {
  pool,
  testConnection
};
