const Game = require('../models/game.model');

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function findByIgdbId(igdbId) { return Game.findOne({ igdbId }); }
function upsertGame(game) {
  return Game.findOneAndUpdate({ igdbId: game.igdbId }, { $set: game }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
}
function searchByName(query, limit) {
  return Game.find({ name: { $regex: escapeRegex(query), $options: 'i' } }).sort({ totalRating: -1, name: 1 }).limit(limit);
}
function findPopular(limit) { return Game.find({ totalRating: { $ne: null } }).sort({ totalRating: -1, totalRatingCount: -1 }).limit(limit); }
function findByGenre(genre, limit) {
  return Game.find({ 'genres.name': { $regex: `^${escapeRegex(genre)}$`, $options: 'i' } }).sort({ totalRating: -1, totalRatingCount: -1 }).limit(limit);
}

module.exports = { findByIgdbId, upsertGame, searchByName, findPopular, findByGenre };
