const express = require("express");
const router = express.Router();

const controller = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middlewares");
const { requireAdmin } = require("../middlewares/auth.middlewares");

router.get("/health", controller.healthCheck);
router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/verify-email", controller.verifyEmail);
router.post("/resend-verification", controller.resendVerificationEmail);
router.post("/forgot-password", controller.forgotPassword);
router.post("/reset-password", controller.resetPassword);
router.put("/change-password", authMiddleware, controller.changePassword);
router.put("/username", authMiddleware, controller.updateUsername);
router.get(
  "/admin/stats",
  authMiddleware,
  requireAdmin,
  controller.getAdminStats
);
router.get(
  "/admin/users/:authId/status",
  authMiddleware,
  requireAdmin,
  controller.getAccountStatus
);
router.patch(
  "/admin/users/:authId/suspend",
  authMiddleware,
  requireAdmin,
  controller.suspendUser
);
router.patch(
  "/admin/users/:authId/ban",
  authMiddleware,
  requireAdmin,
  controller.banUser
);
router.patch(
  "/admin/users/:authId/unban",
  authMiddleware,
  requireAdmin,
  controller.unbanUser
);

module.exports = router;
