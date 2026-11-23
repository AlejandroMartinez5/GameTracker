const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../helpers.cjs");

const game = {
  id: 42,
  name: "Pixel Quest",
  involved_companies: [{ developer: true, company: { id: 7, name: "Pixel Studio" } }]
};
const cached = { igdbId: 42, name: game.name, developers: [{ igdbId: 7, name: "Pixel Studio" }] };

function buildService(t, overrides = {}) {
  const repository = {
    findByIgdbId: t.mock.fn(async () => null),
    searchByName: t.mock.fn(async () => []),
    findPopular: t.mock.fn(async () => []),
    findByGenre: t.mock.fn(async () => []),
    upsertGame: t.mock.fn(async (document) => document),
    getAdminStats: t.mock.fn(async () => ({ totalGames: 1 })),
    ...overrides.repository
  };
  const igdb = {
    getGameById: t.mock.fn(async () => game),
    searchGames: t.mock.fn(async () => [game]),
    getPopularGames: t.mock.fn(async () => [game]),
    getGamesByGenre: t.mock.fn(async () => [game]),
    ...overrides.igdb
  };
  const service = loadWithMocks("services/games.service.js", {
    "../clients/igdb.client": igdb,
    "../repositories/games.repository": repository
  });
  return { service, repository, igdb };
}

describe("getGameById", () => {
  it("usa la caché cuando el juego ya tiene datos de un estudio", async (t) => {
    const { service, repository, igdb } = buildService(t, {
      repository: { findByIgdbId: t.mock.fn(async () => cached) }
    });

    assert.equal((await service.getGameById("42")).igdbId, 42);
    assert.deepEqual(repository.findByIgdbId.mock.calls[0].arguments, [42]);
    assert.equal(igdb.getGameById.mock.callCount(), 0);
    assert.equal(repository.upsertGame.mock.callCount(), 0);
  });

  for (const entry of [null, { igdbId: 42, name: game.name }]) {
    it(entry ? "actualiza una entrada sin datos de estudios" : "guarda un juego ausente de la caché", async (t) => {
      const { service, repository, igdb } = buildService(t, {
        repository: { findByIgdbId: async () => entry }
      });

      const result = await service.getGameById("42");
      const [document] = repository.upsertGame.mock.calls[0].arguments;
      assert.deepEqual(igdb.getGameById.mock.calls[0].arguments, [42]);
      assert.equal(document.igdbId, 42);
      assert.deepEqual(document.developers, cached.developers);
      assert.equal(result.name, game.name);
    });
  }

  it("devuelve 404 cuando IGDB no encuentra el juego", async (t) => {
    const { service, repository } = buildService(t, {
      igdb: { getGameById: async () => null }
    });

    await assert.rejects(service.getGameById(42), { status: 404 });
    assert.equal(repository.upsertGame.mock.callCount(), 0);
  });
});

describe("listados del catálogo", () => {
  for (const [method, cacheMethod, input, upstreamArgs] of [
    ["searchGames", "searchByName", ["  Pixel   Quest  ", "1"], ["Pixel Quest", 1]],
    ["getPopularGames", "findPopular", ["1"], [1]],
    ["getGamesByGenre", "findByGenre", ["  Role   Playing  ", "1"], ["Role Playing", 1]]
  ]) {
    it(method + " devuelve la caché cuando alcanza el límite", async (t) => {
      const { service, repository, igdb } = buildService(t, {
        repository: { [cacheMethod]: t.mock.fn(async () => [cached]) }
      });

      const result = await service[method](...input);
      assert.equal(result.source, "cache");
      assert.deepEqual(result.results.map(({ igdbId }) => igdbId), [42]);
      assert.deepEqual(repository[cacheMethod].mock.calls[0].arguments, upstreamArgs);
      assert.equal(igdb[method].mock.callCount(), 0);
    });

    it(method + " consulta IGDB y guarda el juego si la caché es insuficiente", async (t) => {
      const { service, repository, igdb } = buildService(t);

      const result = await service[method](...input);
      assert.equal(result.source, "igdb");
      assert.deepEqual(result.results.map(({ igdbId }) => igdbId), [42]);
      assert.deepEqual(igdb[method].mock.calls[0].arguments, upstreamArgs);
      assert.equal(repository.upsertGame.mock.callCount(), 1);
    });
  }

  it("rechaza límites fuera de rango antes de consultar", async (t) => {
    const { service, repository, igdb } = buildService(t);

    for (const limit of [0, 1.5, 51]) {
      await assert.rejects(service.getPopularGames(limit), { status: 400 });
    }
    assert.equal(repository.findPopular.mock.callCount(), 0);
    assert.equal(igdb.getPopularGames.mock.callCount(), 0);
  });
});

describe("getDashboard", () => {
  it("agrupa los juegos y elimina géneros repetidos o vacíos", async (t) => {
    const { service, repository } = buildService(t, {
      repository: {
        findPopular: async () => [cached],
        findByGenre: t.mock.fn(async (genre) => [{ ...cached, name: genre }])
      }
    });

    const result = await service.getDashboard("1", " Action, RPG, Action, ");
    assert.deepEqual(result.genres, ["Action", "RPG"]);
    assert.deepEqual(repository.findByGenre.mock.calls.map((call) => call.arguments), [
      ["Action", 1], ["RPG", 1]
    ]);
    assert.equal(result.limit, 1);
    assert.equal(result.popular[0].name, game.name);
    assert.equal(result.byGenre.Action[0].name, "Action");
    assert.equal(result.byGenre.RPG[0].name, "RPG");
  });

  it("rechaza listas vacías o con más de diez géneros antes de consultar", async (t) => {
    const { service, repository } = buildService(t);

    for (const genres of [" , ", Array.from({ length: 11 }, (_, i) => "Genre " + i)]) {
      await assert.rejects(service.getDashboard(1, genres), { status: 400 });
    }
    assert.equal(repository.findPopular.mock.callCount(), 0);
    assert.equal(repository.findByGenre.mock.callCount(), 0);
  });
});

describe("getAdminStats", () => {
  it("devuelve las estadísticas calculadas por el repositorio", async (t) => {
    const { service, repository } = buildService(t);

    assert.deepEqual(await service.getAdminStats(), { totalGames: 1 });
    assert.equal(repository.getAdminStats.mock.callCount(), 1);
  });
});
