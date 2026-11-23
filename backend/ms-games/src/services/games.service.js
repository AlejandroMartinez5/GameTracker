const igdb = require('../clients/igdb.client');
const repository = require('../repositories/games.repository');
const { toGameResponse, toGameDocument } = require('../dtos/game.dto');

function limitValue(value) {
  const limit = Number(value ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Object.assign(new Error('El parámetro limit debe ser un entero entre 1 y 50'), { status: 400 });
  return limit;
}
function cleanTerm(value) { return value.replace(/[";\r\n]/g, ' ').replace(/\s+/g, ' ').trim(); }

async function getGameById(value) {
  const igdbId = Number(value);
  const cached = await repository.findByIgdbId(igdbId);
  if (cached && (cached.developers?.length > 0 || cached.publishers?.length > 0)) {
    return toGameResponse(cached);
  }
  const game = await igdb.getGameById(igdbId);
  if (!game) throw Object.assign(new Error('Videojuego no encontrado'), { status: 404 });
  return toGameResponse(await repository.upsertGame(toGameDocument(game)));
}

async function searchGames(query, requestedLimit) {
  const limit = limitValue(requestedLimit); const term = cleanTerm(query);
  const cached = await repository.searchByName(term, limit);
  if (cached.length >= limit) return { query, source: 'cache', results: cached.map(toGameResponse) };
  const games = await igdb.searchGames(term, limit);
  const saved = await Promise.all(games.map(game => repository.upsertGame(toGameDocument(game))));
  return { query, source: 'igdb', results: saved.map(toGameResponse) };
}

async function getPopularGames(requestedLimit) {
  const limit = limitValue(requestedLimit); const cached = await repository.findPopular(limit);
  if (cached.length >= limit) return { source: 'cache', results: cached.map(toGameResponse) };
  const games = await igdb.getPopularGames(limit);
  const saved = await Promise.all(games.map(game => repository.upsertGame(toGameDocument(game))));
  return { source: 'igdb', results: saved.map(toGameResponse) };
}

async function getGamesByGenre(genre, requestedLimit) {
  const limit = limitValue(requestedLimit); const term = cleanTerm(genre);
  const cached = await repository.findByGenre(term, limit);
  if (cached.length >= limit) return { genre, source: 'cache', results: cached.map(toGameResponse) };
  const games = await igdb.getGamesByGenre(term, limit);
  const saved = await Promise.all(games.map(game => repository.upsertGame(toGameDocument(game))));
  return { genre, source: 'igdb', results: saved.map(toGameResponse) };
}

function dashboardGenres(value) {
  const genres = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : ['Action', 'Adventure', 'RPG', 'Strategy'];

  const normalized = [...new Set(genres.map(genre => genre.trim()).filter(Boolean))];

  if (!normalized.length || normalized.length > 10) {
    throw Object.assign(new Error('genres debe contener entre 1 y 10 generos'), { status: 400 });
  }

  return normalized;
}

async function getDashboard(requestedLimit, requestedGenres) {
  const limit = limitValue(requestedLimit);
  const genres = dashboardGenres(requestedGenres);
  const [popular, ...genreResults] = await Promise.all([
    getPopularGames(limit),
    ...genres.map(genre => getGamesByGenre(genre, limit))
  ]);

  return {
    popular: popular.results,
    byGenre: Object.fromEntries(genres.map((genre, index) => [genre, genreResults[index].results])),
    genres,
    limit
  };
}

async function getAdminStats() {
  return repository.getAdminStats();
}

module.exports = { getGameById, searchGames, getPopularGames, getGamesByGenre, getDashboard, getAdminStats };
