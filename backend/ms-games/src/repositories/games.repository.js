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
async function getAdminStats() {
  const [totalGames, ratedGames, ratingResult, genreRows] = await Promise.all([
    Game.countDocuments(),
    Game.countDocuments({ totalRating: { $ne: null } }),
    Game.aggregate([{ $match: { totalRating: { $ne: null } } }, { $group: { _id: null, average: { $avg: '$totalRating' } } }]),
    Game.aggregate([
      { $unwind: { path: '$genres', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$genres.name', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 20 }
    ])
  ]);

  return {
    totalGames,
    ratedGames,
    unratedGames: totalGames - ratedGames,
    averageRating: ratingResult[0]?.average ? Number(ratingResult[0].average.toFixed(2)) : 0,
    byGenre: genreRows.map(row => ({ genre: row._id, count: row.count }))
  };
}

module.exports = { findByIgdbId, upsertGame, searchByName, findPopular, findByGenre, getAdminStats };
