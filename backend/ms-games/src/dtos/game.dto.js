function coverUrl(imageId) { return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null; }
function reference(value) { return { igdbId: value.id ?? value.igdbId ?? null, name: value.name ?? null }; }

function toGameResponse(game) {
  const firstReleaseDate = game.firstReleaseDate ?? (game.first_release_date ? new Date(game.first_release_date * 1000) : null);
  const imageId = game.cover?.imageId ?? game.cover?.image_id ?? null;
  return {
    igdbId: game.igdbId ?? game.id, name: game.name ?? null, slug: game.slug ?? null,
    summary: game.summary ?? null, storyline: game.storyline ?? null, firstReleaseDate,
    cover: { imageId, url: game.cover?.url ?? coverUrl(imageId) },
    genres: (game.genres || []).map(reference), platforms: (game.platforms || []).map(reference),
    gameModes: (game.gameModes || game.game_modes || []).map(reference),
    playerPerspectives: (game.playerPerspectives || game.player_perspectives || []).map(reference),
    rating: game.rating ?? null, ratingCount: game.ratingCount ?? game.rating_count ?? null,
    totalRating: game.totalRating ?? game.total_rating ?? null,
    totalRatingCount: game.totalRatingCount ?? game.total_rating_count ?? null,
    url: game.url ?? null, lastSyncedAt: game.lastSyncedAt ?? null
  };
}
function toGameDocument(game) {
  return { ...toGameResponse(game), igdbUpdatedAt: game.updated_at ? new Date(game.updated_at * 1000) : null, lastSyncedAt: new Date() };
}

module.exports = { toGameResponse, toGameDocument };
