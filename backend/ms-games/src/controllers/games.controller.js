const gamesService = require('../services/games.service');

function validId(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

async function getGameById(req, res, next) {
  try {
    if (!validId(req.params.igdbId)) return res.status(400).json({ message: 'El igdbId debe ser numérico y mayor que 0' });
    return res.json(await gamesService.getGameById(req.params.igdbId));
  } catch (error) { return next(error); }
}

async function searchGames(req, res, next) {
  try {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ message: 'El parámetro q es obligatorio' });
    return res.json(await gamesService.searchGames(query, req.query.limit));
  } catch (error) { return next(error); }
}

async function getPopularGames(req, res, next) {
  try { return res.json(await gamesService.getPopularGames(req.query.limit)); }
  catch (error) { return next(error); }
}

async function getGamesByGenre(req, res, next) {
  try {
    const genre = req.params.genre?.trim();
    if (!genre) return res.status(400).json({ message: 'El género es obligatorio' });
    return res.json(await gamesService.getGamesByGenre(genre, req.query.limit));
  } catch (error) { return next(error); }
}

module.exports = { getGameById, searchGames, getPopularGames, getGamesByGenre };
