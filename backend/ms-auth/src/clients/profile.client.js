const { requestService } = require("./service.client");

const request = (baseUrl, path, token) => requestService({
  baseUrl,
  path,
  token,
  unwrapData: false
});

const getProfileDetails = async ({ authId, token }) => {
  const reviewsBaseUrl = process.env.REVIEWS_SERVICE_URL || "http://localhost:3005/api";
  const libraryBaseUrl = process.env.USER_LIBRARY_SERVICE_URL || "http://localhost:3010/api";
  const friendsBaseUrl = process.env.FRIENDS_SERVICE_URL || "http://localhost:3006/api";

  const requests = await Promise.allSettled([
    request(reviewsBaseUrl, `/reviews/user/${encodeURIComponent(authId)}?page=1&limit=10`, token),
    request(reviewsBaseUrl, `/reviews/user/${encodeURIComponent(authId)}/summary`, token),
    request(libraryBaseUrl, `/favorites/user/${encodeURIComponent(authId)}?page=1&limit=10`, token),
    request(friendsBaseUrl, `/friends/user/${encodeURIComponent(authId)}?page=1&limit=10`, token),
    request(friendsBaseUrl, `/friends/user/${encodeURIComponent(authId)}/summary`, token)
  ]);

  const unavailableServices = new Set();
  const value = (index, serviceName, fallback) => {
    const result = requests[index];

    if (result.status === "fulfilled") return result.value;

    unavailableServices.add(serviceName);
    return fallback;
  };

  const reviewsResponse = value(0, "reviews", {});
  const reviewsSummaryResponse = value(1, "reviews", {});
  const libraryResponse = value(2, "library", {});
  const friendsResponse = value(3, "friends", {});
  const friendsSummaryResponse = value(4, "friends", {});
  const reviewsResult = reviewsResponse.data || {};
  const reviewsSummary = reviewsSummaryResponse.data || null;
  const libraryResult = libraryResponse.data || [];
  const friendsResult = friendsResponse.data || [];
  const friendsSummary = friendsSummaryResponse.data || null;

  return {
    reviews: reviewsResult.reviews || [],
    reviewsPagination: reviewsResult.pagination || null,
    reviewsSummary,
    library: libraryResult,
    libraryPagination: libraryResponse.pagination || null,
    friends: friendsResult,
    friendsPagination: friendsResponse.pagination || null,
    friendsSummary,
    unavailableServices: [...unavailableServices]
  };
};

module.exports = { getProfileDetails };
