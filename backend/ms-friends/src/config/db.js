const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTables = async () => {
  await pool.query(`
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
  `);

  console.log("Tabla friend_requests verificada/creada");
};

const testConnection = async (retries = 10, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL conectado correctamente en ms-friends");

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
