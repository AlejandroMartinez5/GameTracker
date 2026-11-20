const leaderboardsRepository = require("../repositories/leaderboards.repository");

const VALID_PERIODS = {
  "24h": 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  all: null
};

const normalizePeriod = (period = "week") => {
  if (!Object.prototype.hasOwnProperty.call(VALID_PERIODS, period)) {
    const error = new Error("period debe ser uno de: 24h, week, month, all");
    error.status = 400;
    throw error;
  }

  return period;
};

const getPeriodStart = (period) => {
  const periodMs = VALID_PERIODS[period];

  if (periodMs === null) {
    return null;
  }

  return new Date(Date.now() - periodMs);
};

const splitCurrentUserEntry = (rows, authId) => {
  const top = rows.filter((row) => row.rank <= leaderboardsRepository.TOP_LIMIT);

  if (!authId) {
    return {
      top,
      currentUser: null,
      currentUserEntries: []
    };
  }

  const currentUserEntries = rows.filter((row) => row.auth_id === authId);
  const currentUser = currentUserEntries[0] || null;

  if (!currentUser) {
    return {
      top,
      currentUser: null,
      currentUserEntries: []
    };
  }

  return {
    top,
    currentUser,
    currentUserEntries
  };
};

const buildLeaderboardResponse = ({ period, rows, authId }) => {
  const { top, currentUser, currentUserEntries } = splitCurrentUserEntry(
    rows,
    authId
  );

  return {
    period,
    limit: leaderboardsRepository.TOP_LIMIT,
    top,
    currentUser,
    currentUserEntries
  };
};

const getTopUsers = async ({ period } = {}, user = null) => {
  const normalizedPeriod = normalizePeriod(period);
  const rows = await leaderboardsRepository.getTopUsers(
    getPeriodStart(normalizedPeriod),
    user?.authId || null
  );

  return buildLeaderboardResponse({
    period: normalizedPeriod,
    rows,
    authId: user?.authId || null
  });
};

const getTopReviews = async ({ period } = {}, user = null) => {
  const normalizedPeriod = normalizePeriod(period);
  const rows = await leaderboardsRepository.getTopReviews(
    getPeriodStart(normalizedPeriod),
    user?.authId || null
  );

  return buildLeaderboardResponse({
    period: normalizedPeriod,
    rows,
    authId: user?.authId || null
  });
};

const getTopComments = async ({ period } = {}, user = null) => {
  const normalizedPeriod = normalizePeriod(period);
  const rows = await leaderboardsRepository.getTopComments(
    getPeriodStart(normalizedPeriod),
    user?.authId || null
  );

  return buildLeaderboardResponse({
    period: normalizedPeriod,
    rows,
    authId: user?.authId || null
  });
};

module.exports = {
  getTopUsers,
  getTopReviews,
  getTopComments
};
