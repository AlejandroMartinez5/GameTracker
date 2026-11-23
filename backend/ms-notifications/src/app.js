const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes/notifications.routes");
const { pool } = require("./config/db");

const app = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin))
}));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); return res.json({ status: "ok" }); }
  catch { return res.status(503).json({ status: "unavailable" }); }
});
app.use("/api/notifications", routes);
app.use((_req, res) => res.status(404).json({ message: "Ruta no encontrada" }));
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.status ? error.message : "Error interno del servidor" }));

module.exports = app;

