const igdb = require('../config/igdb');
const repository = require('../repositories/games.repository');
const { toGameResponse, toGameDocument } = require('../dtos/game.dto');

const FIELDS = ['id', 'name', 'slug', 'summary', 'storyline', 'first_release_date', 'cover.image_id', 'genres.name', 'platforms.name', 'game_modes.name', 'player_perspectives.name', 'rating', 'rating_count', 'total_rating', 'total_rating_count', 'url', 'updated_at'].join(',');

function limitValue(value) {
  const limit = Number(value ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Object.assign(new Error('El parámetro limit debe ser un entero entre 1 y 50'), { status: 400 });
  return limit;
}
function cleanTerm(value) { return value.replace(/[";\r\n]/g, ' ').replace(/\s+/g, ' ').trim(); }

async function getGameById(value) {
  const igdbId = Number(value);
  const cached = await repository.findByIgdbId(igdbId);
  if (cached) return toGameResponse(cached);
  const games = await igdb.queryGames(`fields ${FIELDS}; where id = ${igdbId}; limit 1;`);
  if (!games.length) throw Object.assign(new Error('Videojuego no encontrado'), { status: 404 });
  return toGameResponse(await repository.upsertGame(toGameDocument(games[0])));
}

async function searchGames(query, requestedLimit) {
  const limit = limitValue(requestedLimit); const term = cleanTerm(query);
  const cached = await repository.searchByName(term, limit);
  if (cached.length >= limit) return { query, source: 'cache', results: cached.map(toGameResponse) };
  const games = await igdb.queryGames(`search "${term}"; fields ${FIELDS}; where version_parent = null; limit ${limit};`);
  const saved = await Promise.all(games.map(game => repository.upsertGame(toGameDocument(game))));
  return { query, source: 'igdb', results: saved.map(toGameResponse) };
}

async function getPopularGames(requestedLimit) {
  const limit = limitValue(requestedLimit); const cached = await repository.findPopular(limit);
  if (cached.length >= limit) return { source: 'cache', results: cached.map(toGameResponse) };
  const games = await igdb.queryGames(`fields ${FIELDS}; where total_rating != null; sort total_rating desc; limit ${limit};`);
  const saved = await Promise.all(games.map(game => repository.upsertGame(toGameDocument(game))));
  return { source: 'igdb', results: saved.map(toGameResponse) };
}

async function getGamesByGenre(genre, requestedLimit) {
  const limit = limitValue(requestedLimit); const term = cleanTerm(genre);
  const cached = await repository.findByGenre(term, limit);
  if (cached.length >= limit) return { genre, source: 'cache', results: cached.map(toGameResponse) };
  const games = await igdb.queryGames(`search "${term}"; fields ${FIELDS}; where genres.name ~ *"${term}"*; limit ${limit};`);
  const saved = await Promise.all(games.map(game => repository.upsertGame(toGameDocument(game))));
  return { genre, source: 'igdb', results: saved.map(toGameResponse) };
}

module.exports = { getGameById, searchGames, getPopularGames, getGamesByGenre };
