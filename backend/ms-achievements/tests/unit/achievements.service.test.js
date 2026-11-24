const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../helpers.cjs");

function buildService(t, unlocked = []) {
  const summary = { authId: "user-1", achievements: [] };
  const definitions = [{ code: "tenure" }];
  const repository = {
    getDefinitions: t.mock.fn(async () => definitions),
    getUserSummary: t.mock.fn(async () => summary),
    evaluateTenureAchievements: t.mock.fn(async () => unlocked)
  };
  const publishAchievementUnlocked = t.mock.fn(async () => {});
  const service = loadWithMocks("services/achievements.service.js", {
    "../repositories/achievements.repository": repository,
    "../utils/notification-events.util": { publishAchievementUnlocked }
  });
  return { service, repository, publishAchievementUnlocked, summary, definitions };
}

describe("achievements.service", () => {
  it("devuelve las definiciones del catálogo", async (t) => {
    const { service, repository, definitions } = buildService(t);
    assert.equal(await service.getCatalog(), definitions);
    assert.equal(repository.getDefinitions.mock.callCount(), 1);
  });

  it("evalúa la antigüedad y publica los logros antes de consultar el resumen", async (t) => {
    const unlocked = [{ authId: "user-1", code: "tenure" }, { authId: "user-2", code: "tenure" }];
    const { service, repository, publishAchievementUnlocked, summary } = buildService(t, unlocked);
    t.mock.method(repository, "getUserSummary", async (id) => {
      assert.equal(id, "user-1");
      assert.deepEqual(publishAchievementUnlocked.mock.calls.map((call) => call.arguments[0]),
        unlocked.map((achievement) => ({ recipientAuthId: achievement.authId, achievement })));
      return summary;
    });

    assert.equal(await service.getUserAchievements(" user-1 "), summary);
    assert.equal(repository.evaluateTenureAchievements.mock.callCount(), 1);
  });

  it("rechaza IDs vacíos o demasiado largos antes de evaluar la antigüedad", async (t) => {
    const { service, repository } = buildService(t);
    await assert.rejects(service.getUserAchievements(" "), { status: 400 });
    await assert.rejects(service.getUserAchievements("a".repeat(256)), { status: 400 });
    assert.equal(repository.evaluateTenureAchievements.mock.callCount(), 0);
  });

  it("evalúa al iniciar y respeta el intervalo mínimo", async (t) => {
    const previous = process.env.ACHIEVEMENTS_TENURE_CHECK_INTERVAL_MS;
    process.env.ACHIEVEMENTS_TENURE_CHECK_INTERVAL_MS = "100";
    t.after(() => {
      if (previous === undefined) delete process.env.ACHIEVEMENTS_TENURE_CHECK_INTERVAL_MS;
      else process.env.ACHIEVEMENTS_TENURE_CHECK_INTERVAL_MS = previous;
    });
    const interval = {};
    const schedule = t.mock.method(globalThis, "setInterval", () => interval);
    const { service, repository, publishAchievementUnlocked } = buildService(t);

    assert.equal(service.startTenureEvaluation(), interval);
    assert.equal(repository.evaluateTenureAchievements.mock.callCount(), 1);
    const [evaluate, delay] = schedule.mock.calls[0].arguments;
    assert.equal(delay, 60_000);
    await evaluate();
    assert.equal(repository.evaluateTenureAchievements.mock.callCount(), 2);
    assert.equal(publishAchievementUnlocked.mock.callCount(), 0);
  });
});
