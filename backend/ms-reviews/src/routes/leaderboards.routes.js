const express = require("express");
const leaderboardsController = require("../controllers/leaderboards.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/users", authenticateToken, leaderboardsController.getTopUsers);
router.get("/reviews", authenticateToken, leaderboardsController.getTopReviews);
router.get("/comments", authenticateToken, leaderboardsController.getTopComments);

module.exports = router;
