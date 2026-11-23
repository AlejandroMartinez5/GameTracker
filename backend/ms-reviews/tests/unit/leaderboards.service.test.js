const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const leaderboardsRepository = require("../../src/repositories/leaderboards.repository");
const service = require("../../src/services/leaderboards.service");
const { makeUser, AUTH_ID } = require("../helpers");

const DAY_MS = 24 * 60 * 60 * 1000;

const rows = [
  { rank: 1, auth_id: "a" },
  { rank: 30, auth_id: "b" },
  { rank: 42, auth_id: AUTH_ID },
  { rank: 43, auth_id: AUTH_ID }
];

describe("leaderboards.service", () => {
  afterEach(() => mock.restoreAll());

  for (const fn of ["getTopUsers", "getTopReviews", "getTopComments"]) {
    describe(fn, () => {
      it("usa el periodo 'week' por defecto", async () => {
        const repo = mock.method(leaderboardsRepository, fn, async () => []);
        const before = Date.now();

        const result = await service[fn]();

        const [periodStart, authId] = repo.mock.calls[0].arguments;
        assert.equal(result.period, "week");
        assert.equal(authId, null);
        assert.ok(periodStart instanceof Date);
        assert.ok(Math.abs(before - 7 * DAY_MS - periodStart.getTime()) < 1000);
      });

      it("period=all no filtra por fecha", async () => {
        const repo = mock.method(leaderboardsRepository, fn, async () => []);

        await service[fn]({ period: "all" });

        assert.equal(repo.mock.calls[0].arguments[0], null);
      });

      it("rechaza periodos inválidos", async () => {
        await assert.rejects(service[fn]({ period: "year" }), {
          status: 400,
          message: "period debe ser uno de: 24h, week, month, all"
        });
      });
    });
  }

  it("calcula 24h y month correctamente", async () => {
    const repo = mock.method(leaderboardsRepository, "getTopUsers", async () => []);

    await service.getTopUsers({ period: "24h" });
    await service.getTopUsers({ period: "month" });

    const [day, month] = repo.mock.calls.map((c) => c.arguments[0].getTime());
    assert.ok(Math.abs(Date.now() - DAY_MS - day) < 1000);
    assert.ok(Math.abs(Date.now() - 30 * DAY_MS - month) < 1000);
  });

  it("separa el top 30 de la posición del usuario actual", async () => {
    mock.method(leaderboardsRepository, "getTopReviews", async () => rows);

    const result = await service.getTopReviews({ period: "all" }, makeUser());

    assert.equal(result.limit, 30);
    assert.deepEqual(result.top.map((r) => r.rank), [1, 30]);
    assert.deepEqual(result.currentUser, rows[2]);
    assert.deepEqual(result.currentUserEntries, [rows[2], rows[3]]);
  });

  it("currentUser es null si el usuario no aparece", async () => {
    mock.method(leaderboardsRepository, "getTopUsers", async () => rows.slice(0, 2));

    const result = await service.getTopUsers({}, makeUser());

    assert.equal(result.currentUser, null);
    assert.deepEqual(result.currentUserEntries, []);
  });

  it("sin usuario no calcula currentUser", async () => {
    mock.method(leaderboardsRepository, "getTopComments", async () => rows);

    const result = await service.getTopComments({}, null);

    assert.equal(result.currentUser, null);
    assert.equal(result.top.length, 2);
  });
});
