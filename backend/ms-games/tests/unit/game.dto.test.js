const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { toGameResponse, toGameDocument } = require("../../src/dtos/game.dto");

describe("game.dto", () => {
  it("convierte fechas, imágenes y relaciones de IGDB al contrato del catálogo", () => {
    const result = toGameResponse({
      id: 42, name: "Pixel Quest", first_release_date: 1700000000,
      cover: { image_id: "example" }, genres: [{ id: 1, name: "Action" }],
      game_modes: [{ id: 2, name: "Single player" }],
      involved_companies: [
        { developer: true, company: { id: 7, name: "Pixel Studio" } },
        { publisher: true, company: { id: 8, name: "Pixel Publishing" } }
      ],
      total_rating: 88, total_rating_count: 3
    });

    assert.equal(result.igdbId, 42);
    assert.deepEqual(result.firstReleaseDate, new Date(1700000000000));
    assert.deepEqual(result.cover, {
      imageId: "example", url: "https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg"
    });
    assert.deepEqual(result.genres, [{ igdbId: 1, name: "Action" }]);
    assert.deepEqual(result.gameModes, [{ igdbId: 2, name: "Single player" }]);
    assert.deepEqual(result.developers, [{ igdbId: 7, name: "Pixel Studio" }]);
    assert.deepEqual(result.publishers, [{ igdbId: 8, name: "Pixel Publishing" }]);
    assert.equal(result.totalRating, 88);
    assert.equal(result.totalRatingCount, 3);
  });

  it("usa valores vacíos cuando faltan datos opcionales", () => {
    const result = toGameResponse({ igdbId: 42, name: "Pixel Quest", ratingCount: 0 });

    assert.deepEqual(result.cover, { imageId: null, url: null });
    assert.equal(result.firstReleaseDate, null);
    assert.deepEqual(result.developers, []);
    assert.deepEqual(result.platforms, []);
    assert.equal(result.ratingCount, 0);
  });

  it("conserva la fecha de IGDB y registra la fecha de sincronización", () => {
    const start = Date.now();
    const document = toGameDocument({ id: 42, updated_at: 1700000000 });

    assert.deepEqual(document.igdbUpdatedAt, new Date(1700000000000));
    assert.ok(document.lastSyncedAt.getTime() >= start);
    assert.ok(document.lastSyncedAt.getTime() <= Date.now());
  });
});
