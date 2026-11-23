const router = require("express").Router();
const controller = require("../controllers/achievements.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

router.get("/", controller.getCatalog);
router.get("/me", authenticateToken, controller.getMine);
router.get("/users/:authId", authenticateToken, controller.getUser);

module.exports = router;
