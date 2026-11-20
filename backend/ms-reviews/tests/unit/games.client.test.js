const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const { assertGameExists } = require("../../src/clients/games.client");

describe("games.client.assertGameExists", () => {
  beforeEach(() => {
    process.env.GAMES_SERVICE_URL = "http://games.test/api/games/";
  });

  afterEach(() => {
    mock.restoreAll();
    delete process.env.GAMES_SERVICE_URL;
  });

  it("llama a ms-games con el token y resuelve si responde 200", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200 }));

    await assertGameExists({ igdbId: 1942, token: "abc" });

    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, "http://games.test/api/games/1942");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, "Bearer abc");
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("usa la URL por defecto si no hay variable de entorno", async () => {
    delete process.env.GAMES_SERVICE_URL;
    const fetchMock = mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200 }));

    await assertGameExists({ igdbId: 1, token: "t" });

    assert.equal(fetchMock.mock.calls[0].arguments[0], "http://localhost:3009/api/games/1");
  });

  it("lanza 404 si el juego no existe", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 }));

    await assert.rejects(assertGameExists({ igdbId: 1, token: "t" }), {
      status: 404,
      message: "Videojuego no encontrado"
    });
  });

  it("lanza 502 si ms-games responde con error", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: false, status: 500 }));

    await assert.rejects(assertGameExists({ igdbId: 1, token: "t" }), { status: 502 });
  });

  it("lanza 502 si ms-games no está disponible", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await assert.rejects(assertGameExists({ igdbId: 1, token: "t" }), {
      status: 502,
      message: "No se pudo verificar el videojuego en este momento"
    });
  });
});
