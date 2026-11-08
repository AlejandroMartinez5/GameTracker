const mongoose = require('mongoose');

const referenceSchema = new mongoose.Schema({ igdbId: Number, name: String }, { _id: false });
const gameSchema = new mongoose.Schema({
  igdbId: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true }, slug: String, summary: String, storyline: String,
  firstReleaseDate: Date, cover: { imageId: String, url: String }, genres: [referenceSchema],
  platforms: [referenceSchema], gameModes: [referenceSchema], playerPerspectives: [referenceSchema],
  rating: Number, ratingCount: Number, totalRating: Number, totalRatingCount: Number, url: String,
  igdbUpdatedAt: Date, lastSyncedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'games' });

module.exports = mongoose.model('Game', gameSchema);
