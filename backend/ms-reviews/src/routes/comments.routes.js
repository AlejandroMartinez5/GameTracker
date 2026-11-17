const express = require("express");
const commentsController = require("../controllers/comments.controller");
const {
  authenticateToken,
  optionalAuthenticateToken
} = require("../middlewares/auth.middleware");
const { uploadImage } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/:commentId/likes", optionalAuthenticateToken, commentsController.getCommentLikes);
router.post("/:commentId/like", authenticateToken, commentsController.likeComment);
router.delete("/:commentId/like", authenticateToken, commentsController.unlikeComment);

router.delete("/:commentId/image", authenticateToken, commentsController.removeCommentImage);
router.post("/:commentId/image", authenticateToken, uploadImage, commentsController.addCommentImage);
router.get("/:commentId/image", commentsController.getCommentImage);

router.get("/:commentId", optionalAuthenticateToken, commentsController.getCommentById);
router.delete("/:commentId", authenticateToken, commentsController.deleteComment);

module.exports = router;
