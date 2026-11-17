const express = require("express");
const wishlistController = require("../controllers/wishlist.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateToken);

router.post("/", wishlistController.add);
router.get("/", wishlistController.get);
router.delete("/:igdbId", wishlistController.remove);
router.get("/:igdbId/check", wishlistController.check);

module.exports = router;
