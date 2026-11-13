const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const friendsRoutes = require("./routes/friends.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => {
  return res.status(200).json({
    message: "ms-friends funcionando"
  });
});

app.use("/api/friends", friendsRoutes);

module.exports = app;
