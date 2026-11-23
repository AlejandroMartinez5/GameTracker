const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../helpers.cjs");

const authId = "user-1";
const favorite = { auth_id: authId, igdb_id: 42 };

function buildService(t, overrides = {}) {
  const repo = {
    find: t.mock.fn(async () => null),
    create: t.mock.fn(async () => favorite),
    countByUser: t.mock.fn(async () => 11),
    getByUser: t.mock.fn(async () => [favorite]),
    remove: t.mock.fn(async () => favorite),
    getAdminStats: t.mock.fn(async () => ({ totalFavorites: 11 })),
    ...overrides
  };
  const publishFavoriteAdded = t.mock.fn(async () => {});
  const service = loadWithMocks("services/favorites.service.js", {
    "../repositories/favorites.repository": repo,
    "../utils/notification-events.util": { publishFavoriteAdded }
  });

  return { service, repo, publishFavoriteAdded };
}

describe("addFavorite", () => {
  it("normaliza los identificadores, guarda el favorito y publica la notificación", async (t) => {
    const { service, repo, publishFavoriteAdded } = buildService(t);

    assert.deepEqual(await service.addFavorite(" user-1 ", "42"), favorite);
    assert.deepEqual(repo.find.mock.calls[0].arguments, [authId, 42]);
    assert.deepEqual(repo.create.mock.calls[0].arguments, [authId, 42]);
    assert.deepEqual(publishFavoriteAdded.mock.calls[0].arguments, [{ authId, igdbId: 42 }]);
  });

  it("rechaza identificadores inválidos antes de consultar el repositorio", async (t) => {
    const { service, repo, publishFavoriteAdded } = buildService(t);

    for (const [user, id] of [[" ", 42], [authId, 0], [authId, 1.5], [authId, "juego"]]) {
      await assert.rejects(service.addFavorite(user, id), { status: 400 });
    }
    assert.equal(repo.find.mock.callCount(), 0);
    assert.equal(publishFavoriteAdded.mock.callCount(), 0);
  });

  it("rechaza un favorito existente con 409", async (t) => {
    const { service, repo, publishFavoriteAdded } = buildService(t, {
      find: async () => favorite
    });

    await assert.rejects(service.addFavorite(authId, 42), { status: 409 });
    assert.equal(repo.create.mock.callCount(), 0);
    assert.equal(publishFavoriteAdded.mock.callCount(), 0);
  });

  it("traduce una inserción duplicada concurrente a 409", async (t) => {
    const { service, publishFavoriteAdded } = buildService(t, {
      create: async () => {
        throw Object.assign(new Error("Duplicado"), { code: "23505" });
      }
    });

    await assert.rejects(service.addFavorite(authId, 42), { status: 409 });
    assert.equal(publishFavoriteAdded.mock.callCount(), 0);
  });

  it("propaga un fallo de persistencia y omite la notificación", async (t) => {
    const failure = new Error("Base de datos no disponible");
    const { service, publishFavoriteAdded } = buildService(t, {
      create: async () => { throw failure; }
    });

    await assert.rejects(service.addFavorite(authId, 42), (error) => error === failure);
    assert.equal(publishFavoriteAdded.mock.callCount(), 0);
  });
});

describe("getFavorites", () => {
  it("consulta los favoritos del usuario con el desplazamiento calculado", async (t) => {
    const { service, repo } = buildService(t);
    const result = await service.getFavorites(" user-1 ", { page: "2", limit: "5" });

    assert.deepEqual(repo.countByUser.mock.calls[0].arguments, [authId]);
    assert.deepEqual(repo.getByUser.mock.calls[0].arguments, [
      authId, { page: 2, limit: 5, offset: 5 }
    ]);
    assert.deepEqual(result, {
      data: [favorite],
      pagination: {
        page: 2, limit: 5, total: 11, totalPages: 3,
        hasNextPage: true, hasPreviousPage: true, nextPage: 3, previousPage: 1
      }
    });
  });

  it("rechaza la paginación inválida antes de consultar los favoritos", async (t) => {
    const { service, repo } = buildService(t);

    await assert.rejects(service.getFavorites(authId, { limit: 51 }), { status: 400 });
    assert.equal(repo.countByUser.mock.callCount(), 0);
    assert.equal(repo.getByUser.mock.callCount(), 0);
  });
});

describe("removeFavorite", () => {
  it("elimina el favorito del usuario solicitado", async (t) => {
    const { service, repo } = buildService(t);

    assert.deepEqual(await service.removeFavorite(" user-1 ", "42"), favorite);
    assert.deepEqual(repo.remove.mock.calls[0].arguments, [authId, 42]);
  });

  it("devuelve 404 si el favorito no existe", async (t) => {
    const { service } = buildService(t, { remove: async () => null });

    await assert.rejects(service.removeFavorite(authId, 42), { status: 404 });
  });
});

describe("getAdminStats", () => {
  it("devuelve las estadísticas del repositorio", async (t) => {
    const { service, repo } = buildService(t);

    assert.deepEqual(await service.getAdminStats(), { totalFavorites: 11 });
    assert.equal(repo.getAdminStats.mock.callCount(), 1);
  });
});
