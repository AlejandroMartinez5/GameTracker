const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const reviewsRoutes = require("./routes/reviews.routes");
const commentsRoutes = require("./routes/comments.routes");
const leaderboardsRoutes = require("./routes/leaderboards.routes");

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

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await require("./config/db").pool.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use("/api/reviews", reviewsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);

app.use((_req, res) => res.status(404).json({ message: "Ruta no encontrada" }));

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido" });
  }

  const status = error.status || 500;

  if (status >= 500) {
    console.error("[ms-reviews] Error no controlado:", error.message);
  }

  return res.status(status).json({
    message: status >= 500 ? "Error interno del servidor" : error.message
  });
});

module.exports = app;
