const favoritesService = require("../services/favorites.service");

const addFavorite = async (req, res) => {
  try {
    const favorite = await favoritesService.addFavorite(
      req.user.authId,
      req.body?.igdbId
    );

    return res.status(201).json({
      message: "Favorito agregado correctamente",
      data: favorite
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getFavorites = async (req, res) => {
  try {
    const result = await favoritesService.getFavorites(
      req.user.authId,
      req.query
    );

    return res.status(200).json({
      message: "Favoritos obtenidos correctamente",
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const getFavoritesByUser = async (req, res) => {
  try {
    const result = await favoritesService.getFavorites(
      req.params.authId,
      req.query
    );

    return res.status(200).json({
      message: "Favoritos del usuario obtenidos correctamente",
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const removeFavorite = async (req, res) => {
  try {
    await favoritesService.removeFavorite(req.user.authId, req.params.igdbId);

    return res.status(200).json({
      message: "Favorito eliminado correctamente"
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

module.exports = {
  addFavorite,
  getFavorites,
  getFavoritesByUser,
  removeFavorite
};
