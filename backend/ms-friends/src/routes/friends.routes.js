const express = require("express");
const friendsController = require("../controllers/friends.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/user/:authId/summary", friendsController.getFriendsSummary);
router.get("/user/:authId", friendsController.getPublicFriends);

router.post("/requests", friendsController.sendFriendRequest);
router.get("/requests/incoming", friendsController.getIncomingRequests);
router.get("/requests/outgoing", friendsController.getOutgoingRequests);
router.put("/requests/:requestId/accept", friendsController.acceptFriendRequest);
router.put("/requests/:requestId/reject", friendsController.rejectFriendRequest);
router.delete("/requests/:requestId", friendsController.cancelFriendRequest);

router.get("/", friendsController.getFriends);
router.get("/:otherAuthId/status", friendsController.getRelationshipStatus);
router.delete("/:friendAuthId", friendsController.removeFriend);

module.exports = router;
