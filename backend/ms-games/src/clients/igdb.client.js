const { queryGames } = require('../config/igdb');

const FIELDS = [
  'id', 'name', 'slug', 'summary', 'storyline', 'first_release_date',
  'cover.image_id', 'genres.name', 'platforms.name', 'game_modes.name',
  'player_perspectives.name', 'rating', 'rating_count', 'total_rating',
  'total_rating_count', 'url', 'updated_at'
].join(',');

function limitValue(value = 10) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw Object.assign(new Error('El parámetro limit debe ser un entero entre 1 y 50'), { status: 400 });
  }
  return limit;
}

function searchTerm(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error('El término de búsqueda es obligatorio'), { status: 400 });
  }
  return JSON.stringify(value.trim());
}

async function getGameById(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw Object.assign(new Error('El ID del videojuego debe ser un entero positivo'), { status: 400 });
  }
  const games = await queryGames(`fields ${FIELDS}; where id = ${id}; limit 1;`);
  return games[0] ?? null;
}

async function searchGames(query, limit = 10) {
  return queryGames(`search ${searchTerm(query)}; fields ${FIELDS}; where version_parent = null; limit ${limitValue(limit)};`);
}

async function getPopularGames(limit = 10) {
  return queryGames(`fields ${FIELDS}; where total_rating != null; sort total_rating desc; limit ${limitValue(limit)};`);
}

async function getGamesByGenre(genre, limit = 10) {
  return queryGames(`fields ${FIELDS}; where genres.name ~ *${searchTerm(genre)}*; limit ${limitValue(limit)};`);
}

module.exports = { getGameById, searchGames, getPopularGames, getGamesByGenre };