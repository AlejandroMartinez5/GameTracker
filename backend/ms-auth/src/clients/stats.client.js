const { requestService } = require("./service.client");

const request = (baseUrl, path, token) => requestService({ baseUrl, path, token });

const getModerationStats = (token) => request(
  process.env.MODERATION_SERVICE_URL || "http://localhost:3007/api/moderation",
  "/admin/stats",
  token
);

const getReviewStats = (token) => request(
  process.env.REVIEWS_SERVICE_URL || "http://localhost:3005/api",
  "/reviews/admin/stats",
  token
);

const getFavoriteStats = (token) => request(
  process.env.USER_LIBRARY_SERVICE_URL || "http://localhost:3010/api",
  "/favorites/admin/stats",
  token
);

const getFriendStats = (token) => request(
  process.env.FRIENDS_SERVICE_URL || "http://localhost:3006/api",
  "/friends/admin/stats",
  token
);

const getGameStats = (token) => request(
  process.env.GAMES_SERVICE_URL || "http://localhost:3009/api/games",
  "/admin/stats",
  token
);

module.exports = {
  getModerationStats,
  getReviewStats,
  getFavoriteStats,
  getFriendStats,
  getGameStats
};
