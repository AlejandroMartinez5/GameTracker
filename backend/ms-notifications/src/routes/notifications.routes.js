const router = require("express").Router();
const controller = require("../controllers/notifications.controller");
const { authenticateToken, requireAdmin } = require("../middlewares/auth.middleware");

router.use(authenticateToken);
router.get("/", controller.getNotifications);
router.get("/unread-count", controller.getUnreadCount);
router.post("/", requireAdmin, controller.createNotification);
router.put("/read-all", controller.markAllAsRead);
router.put("/:notificationId/read", controller.markAsRead);
router.delete("/:notificationId", controller.deleteNotification);

module.exports = router;

