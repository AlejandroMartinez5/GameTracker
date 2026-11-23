const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../helpers.cjs");

function buildClient(t, games = []) {
  const queryGames = t.mock.fn(async () => games);
  const client = loadWithMocks("clients/igdb.client.js", {
    "../config/igdb": { queryGames }
  });
  return { client, queryGames };
}

describe("igdb.client", () => {
  it("devuelve el primer juego de una consulta por ID", async (t) => {
    const game = { id: 42 };
    const { client, queryGames } = buildClient(t, [game]);

    assert.equal(await client.getGameById("42"), game);
    assert.match(queryGames.mock.calls[0].arguments[0], /where id = 42; limit 1;$/);
  });

  it("devuelve null si la consulta por ID queda vacía", async (t) => {
    const { client } = buildClient(t);

    assert.equal(await client.getGameById(42), null);
  });

  it("valida el ID, los términos y el límite antes de consultar", async (t) => {
    const { client, queryGames } = buildClient(t);

    await assert.rejects(client.getGameById(-1), { status: 400 });
    await assert.rejects(client.searchGames(" "), { status: 400 });
    await assert.rejects(client.getGamesByGenre(""), { status: 400 });
    await assert.rejects(client.getPopularGames(51), { status: 400 });
    assert.equal(queryGames.mock.callCount(), 0);
  });

  it("busca por nombre y excluye las variantes", async (t) => {
    const { client, queryGames } = buildClient(t);

    await client.searchGames(" Pixel Quest ", 3);

    const [query] = queryGames.mock.calls[0].arguments;
    assert.match(query, /^search "Pixel Quest"; fields /);
    assert.match(query, /where version_parent = null; limit 3;$/);
  });

  it("filtra por género y ordena los populares por puntuación", async (t) => {
    const { client, queryGames } = buildClient(t);

    await client.getGamesByGenre("Role Playing", 2);
    await client.getPopularGames();

    assert.match(queryGames.mock.calls[0].arguments[0], /where genres\.name ~ \*"Role Playing"\*; limit 2;$/);
    assert.match(queryGames.mock.calls[1].arguments[0], /where total_rating != null; sort total_rating desc; limit 10;$/);
  });
});
