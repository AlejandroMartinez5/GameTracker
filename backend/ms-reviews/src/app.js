const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const reviewsRoutes = require("./routes/reviews.routes");
const commentsRoutes = require("./routes/comments.routes");

const app = express();

app.use(helmet());
app.use(cors());

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
