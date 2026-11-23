const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const friendsRoutes = require("./routes/friends.routes");

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

app.get("/health", (req, res) => {
  return res.status(200).json({
    message: "ms-friends funcionando"
  });
});

app.use("/api/friends", friendsRoutes);

module.exports = app;
