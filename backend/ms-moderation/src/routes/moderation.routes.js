const express = require("express");
const moderationController = require("../controllers/moderation.controller");
const {
  authenticateToken,
  requireAdmin
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateToken);

router.post("/reports", moderationController.createReport);
router.get("/reports/my", moderationController.getMyReports);

router.get(
  "/admin/reports",
  requireAdmin,
  moderationController.getAdminReports
);
router.get(
  "/admin/stats",
  requireAdmin,
  moderationController.getAdminStats
);
router.get(
  "/admin/reports/:reportId",
  requireAdmin,
  moderationController.getAdminReportById
);
router.post(
  "/admin/reports/:reportId/dismiss",
  requireAdmin,
  moderationController.dismissReport
);
router.post(
  "/admin/reports/:reportId/actions",
  requireAdmin,
  moderationController.executeAction
);

module.exports = router;
