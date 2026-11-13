const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schemaPath = path.join(__dirname, "../../sql/init.sql");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const testConnection = async (retries = 10, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      await pool.query(fs.readFileSync(schemaPath, "utf8"));
      console.log("PostgreSQL conectado correctamente en ms-notifications");
      return;
    } catch (error) {
      console.error(`Intento ${attempt}/${retries} fallido: ${error.message}`);
      if (attempt === retries) throw error;
      await wait(delay);
    }
  }
};

module.exports = { pool, testConnection };

