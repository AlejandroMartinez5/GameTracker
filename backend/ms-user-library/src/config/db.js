const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTables = async () => {
  await pool.query(`
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
  `);

  console.log("Tabla favorites verificada/creada");
};

const testConnection = async (retries = 10, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL conectado correctamente en ms-user-library");
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
