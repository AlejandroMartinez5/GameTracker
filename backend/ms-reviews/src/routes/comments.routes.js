const express = require("express");
const commentsController = require("../controllers/comments.controller");
const {
  authenticateToken,
  optionalAuthenticateToken
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/:commentId/likes", optionalAuthenticateToken, commentsController.getCommentLikes);
router.post("/:commentId/like", authenticateToken, commentsController.likeComment);
router.delete("/:commentId/like", authenticateToken, commentsController.unlikeComment);

router.delete("/:commentId/image", authenticateToken, commentsController.removeCommentImage);

router.get("/:commentId", optionalAuthenticateToken, commentsController.getCommentById);
router.delete("/:commentId", authenticateToken, commentsController.deleteComment);

module.exports = router;
