const wishlistService = require("../services/wishlist.service");

const add = async (req, res) => {
  try {
    const data = await wishlistService.addToWishlist(
      req.user.authId,
      req.body?.igdbId
    );

    return res.status(201).json({
      message: "Juego agregado a la wishlist",
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const get = async (req, res) => {
  try {
    const result = await wishlistService.getWishlist(
      req.user.authId,
      req.query
    );

    return res.status(200).json({
      message: "Wishlist obtenida correctamente",
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const remove = async (req, res) => {
  try {
    const data = await wishlistService.removeFromWishlist(
      req.user.authId,
      req.params.igdbId
    );

    return res.status(200).json({
      message: "Juego eliminado de la wishlist",
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const check = async (req, res) => {
  try {
    const exists = await wishlistService.checkWishlist(
      req.user.authId,
      req.params.igdbId
    );

    return res.status(200).json({ exists });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

module.exports = {
  add,
  get,
  remove,
  check
};
