const wishlistRepository = require("../repositories/wishlist.repository");
const { publishWishlistAdded } = require("../utils/notification-events.util");
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

const addToWishlist = async (authId, igdbId) => {
  const user = validateAuthId(authId);
  const gameId = validateIgdbId(igdbId);

  if (await wishlistRepository.exists(user, gameId)) {
    throwError("Este juego ya esta en tu wishlist", 409);
  }

  try {
    const item = await wishlistRepository.add(user, gameId);
    await publishWishlistAdded({ authId: user, igdbId: gameId });
    return item;
  } catch (error) {
    if (error.code === "23505") {
      throwError("Este juego ya esta en tu wishlist", 409);
    }

    throw error;
  }
};

const getWishlist = async (authId, paginationQuery) => {
  const user = validateAuthId(authId);
  const pagination = getPaginationParams(paginationQuery);
  const total = await wishlistRepository.countByUser(user);
  const data = await wishlistRepository.getByUser(user, pagination);

  return {
    data,
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const removeFromWishlist = async (authId, igdbId) => {
  const user = validateAuthId(authId);
  const gameId = validateIgdbId(igdbId);
  const removed = await wishlistRepository.remove(user, gameId);

  if (!removed) {
    throwError("El juego no esta en tu wishlist", 404);
  }

  return removed;
};

const checkWishlist = async (authId, igdbId) => {
  const user = validateAuthId(authId);
  const gameId = validateIgdbId(igdbId);
  return wishlistRepository.exists(user, gameId);
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  checkWishlist
};
