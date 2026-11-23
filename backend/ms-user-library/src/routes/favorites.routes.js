const express = require("express");
const favoritesController = require("../controllers/favorites.controller");
const { authenticateToken, requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/admin/stats", requireAdmin, favoritesController.getAdminStats);
router.post("/", favoritesController.addFavorite);
router.get("/", favoritesController.getFavorites);
router.get("/user/:authId", favoritesController.getFavoritesByUser);
router.delete("/:igdbId", favoritesController.removeFavorite);

module.exports = router;
