const express = require("express");
const reviewsController = require("../controllers/reviews.controller");
const commentsController = require("../controllers/comments.controller");
const {
  authenticateToken,
  optionalAuthenticateToken,
  requireVerifiedEmail
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", authenticateToken, requireVerifiedEmail, reviewsController.createReview);

router.get("/game/:igdbId", optionalAuthenticateToken, reviewsController.getReviewsByGame);
router.get("/user/:authId/summary", optionalAuthenticateToken, reviewsController.getUserReviewsSummary);
router.get("/user/:authId", optionalAuthenticateToken, reviewsController.getReviewsByUser);

router.get("/:reviewId/comments", optionalAuthenticateToken, commentsController.getCommentsByReview);
router.post(
  "/:reviewId/comments",
  authenticateToken,
  requireVerifiedEmail,
  commentsController.createComment
);

router.get("/:reviewId/likes", optionalAuthenticateToken, reviewsController.getReviewLikes);
router.post("/:reviewId/like", authenticateToken, reviewsController.likeReview);
router.delete("/:reviewId/like", authenticateToken, reviewsController.unlikeReview);

router.delete("/:reviewId/image", authenticateToken, reviewsController.removeReviewImage);

router.get("/:reviewId", optionalAuthenticateToken, reviewsController.getReviewById);
router.put("/:reviewId", authenticateToken, reviewsController.updateReview);
router.delete("/:reviewId", authenticateToken, reviewsController.deleteReview);

module.exports = router;
