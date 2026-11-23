const favoritesRepository = require("../repositories/favorites.repository");
const { publishFavoriteAdded } = require("../utils/notification-events.util");
const {
  getPaginationParams,
  buildPaginationMeta
} = require("../utils/pagination.util");

const throwError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const validateAuthId = (authId) => {
  const normalized = authId?.trim();

  if (!normalized) {
    throwError("authId es obligatorio");
  }

  return normalized;
};

const validateIgdbId = (igdbId) => {
  const parsed = Number(igdbId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throwError("igdbId debe ser un entero mayor a 0");
  }

  return parsed;
};

const addFavorite = async (authId, igdbId) => {
  const user = validateAuthId(authId);
  const gameId = validateIgdbId(igdbId);

  if (await favoritesRepository.find(user, gameId)) {
    throwError("Este juego ya esta en favoritos", 409);
  }

  try {
    const favorite = await favoritesRepository.create(user, gameId);
    await publishFavoriteAdded({ authId: user, igdbId: gameId });
    return favorite;
  } catch (error) {
    if (error.code === "23505") {
      throwError("Este juego ya esta en favoritos", 409);
    }

    throw error;
  }
};

const getFavorites = async (authId, paginationQuery) => {
  const user = validateAuthId(authId);
  const pagination = getPaginationParams(paginationQuery);
  const total = await favoritesRepository.countByUser(user);
  const data = await favoritesRepository.getByUser(user, pagination);

  return {
    data,
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const removeFavorite = async (authId, igdbId) => {
  const user = validateAuthId(authId);
  const gameId = validateIgdbId(igdbId);
  const removed = await favoritesRepository.remove(user, gameId);

  if (!removed) {
    throwError("Favorito no encontrado", 404);
  }

  return removed;
};

const getAdminStats = async () => favoritesRepository.getAdminStats();

module.exports = {
  addFavorite,
  getFavorites,
  removeFavorite,
  getAdminStats
};
