const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const moderationRoutes = require("./routes/moderation.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await require('./config/db').pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
app.use("/api/moderation", moderationRoutes);

app.use((_req, res) => res.status(404).json({ message: "Ruta no encontrada" }));
app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ message: status >= 500 ? "Error interno del servidor" : error.message });
});
module.exports = app;
