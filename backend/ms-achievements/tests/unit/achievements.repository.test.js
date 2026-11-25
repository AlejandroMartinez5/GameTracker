const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../helpers.cjs");

function buildRepository(t, { duplicate = false, failure, readRows = [] } = {}) {
  const client = {
    release: t.mock.fn(),
    query: t.mock.fn(async (sql, params) => {
      if (sql.includes("INSERT INTO achievement_processed_events")) return { rowCount: duplicate ? 0 : 1 };
      if (sql.includes("UPDATE achievement_users")) {
        if (failure) throw failure;
        const column = /RETURNING (\w+)/.exec(sql)[1];
        return { rows: [{ [column]: 3 }] };
      }
      if (sql.includes("INSERT INTO user_achievements")) return { rows: [{ authId: params[0], code: params[1] + "_3" }] };
      return { rows: [] };
    })
  };
  const pool = {
    connect: t.mock.fn(async () => client),
    query: t.mock.fn(async () => ({ rows: readRows.shift() }))
  };
  const repository = loadWithMocks("repositories/achievements.repository.js", {
    "../config/db": { pool }
  });
  return { repository, pool, client };
}

describe("processEvent", () => {
  it("omite eventos incompletos o desconocidos sin abrir una transacción", async (t) => {
    const { repository, pool } = buildRepository(t);
    assert.deepEqual(await repository.processEvent({ type: "ReviewCreated" }), { processed: false });
    assert.deepEqual(await repository.processEvent({ eventId: "evt-1", type: "notification.created" }), {
      processed: false, ignored: true
    });
    assert.equal(pool.connect.mock.callCount(), 0);
  });

  it("confirma la transacción de un duplicado sin cambiar el progreso", async (t) => {
    const { repository, client } = buildRepository(t, { duplicate: true });
    const result = await repository.processEvent({ eventId: "evt-1", type: "ReviewCreated" });
    const [[begin], [sql, params], [commit]] = client.query.mock.calls.map((call) => call.arguments);

    assert.deepEqual(result, { processed: false, duplicate: true });
    assert.equal(client.query.mock.callCount(), 3);
    assert.equal(begin, "BEGIN");
    assert.match(sql, /ON CONFLICT \(event_id\) DO NOTHING/);
    assert.deepEqual(params, ["evt-1", "ReviewCreated"]);
    assert.equal(commit, "COMMIT");
    assert.equal(client.release.mock.callCount(), 1);
  });

  it("conserva la fecha de registro del evento de creación de usuario", async (t) => {
    const { repository, client } = buildRepository(t);
    const occurredAt = "2025-01-01T00:00:00.000Z";

    assert.deepEqual(await repository.processEvent({
      eventId: "evt-1", type: "user.created", occurredAt, payload: { authId: "user-1" }
    }), { processed: true, duplicate: false, unlocked: [] });
    const [sql, params] = client.query.mock.calls[2].arguments;
    assert.match(sql, /registered_at = COALESCE/);
    assert.deepEqual(params, ["user-1", occurredAt]);
  });

  for (const [type, field, metric, delta] of [
    ["ReviewCreated", "actorAuthId", "reviews", 1],
    ["ReviewDeletedForAchievements", "authorAuthId", "reviews", -1],
    ["CommentCreated", "authorAuthId", "comments", 1],
    ["CommentDeletedForAchievements", "authorAuthId", "comments", -1],
    ["ReviewLiked", "recipientAuthId", "likes", 1],
    ["ReviewUnliked", "ownerAuthId", "likes", -1],
    ["CommentLiked", "recipientAuthId", "likes", 1],
    ["CommentUnliked", "ownerAuthId", "likes", -1]
  ]) {
    it(type + " ajusta el contador del usuario y evalúa su umbral", async (t) => {
      const { repository, client } = buildRepository(t);
      const result = await repository.processEvent({
        eventId: "evt-1", type, payload: { [field]: "user-1" }
      });
      const [, , , [updateSql, updateParams], [unlockSql, unlockParams], [commit]] =
        client.query.mock.calls.map((call) => call.arguments);

      assert.ok(updateSql.includes("GREATEST(" + metric + "_count + $2, 0)"));
      assert.deepEqual(updateParams, ["user-1", delta]);
      assert.match(unlockSql, /threshold <= \$3/);
      assert.match(unlockSql, /ON CONFLICT \(auth_id, achievement_code\) DO NOTHING/);
      assert.deepEqual(unlockParams, ["user-1", metric, 3]);
      assert.deepEqual(result, {
        processed: true, duplicate: false, unlocked: [{ authId: "user-1", code: metric + "_3" }]
      });
      assert.equal(commit, "COMMIT");
    });
  }

  for (const [type, delta] of [["FriendAccepted", 1], ["FriendRemoved", -1]]) {
    it(type + " actualiza el contador de ambos usuarios", async (t) => {
      const { repository, client } = buildRepository(t);
      const result = await repository.processEvent({
        eventId: "evt-1", type, payload: { requesterAuthId: "user-1", receiverAuthId: "user-2" }
      });
      const updates = client.query.mock.calls.filter((call) => call.arguments[0].includes("UPDATE achievement_users"));

      assert.deepEqual(updates.map((call) => call.arguments[1]), [["user-1", delta], ["user-2", delta]]);
      assert.ok(updates.every((call) => call.arguments[0].includes("friendships_count")));
      assert.deepEqual(result.unlocked.map(({ authId }) => authId), ["user-1", "user-2"]);
    });
  }

  it("revierte el registro del evento si falla la actualización y libera la conexión", async (t) => {
    const failure = new Error("Fallo de escritura");
    const { repository, client } = buildRepository(t, { failure });
    await assert.rejects(repository.processEvent({
      eventId: "evt-1", type: "ReviewCreated", payload: { actorAuthId: "user-1" }
    }), (error) => error === failure);

    assert.deepEqual(client.query.mock.calls.at(-1).arguments, ["ROLLBACK"]);
    assert.equal(client.release.mock.callCount(), 1);
  });
});

describe("getUserSummary", () => {
  const definitions = [{ code: "reviews_3", metric: "reviews" }, { code: "tenure", metric: "account_age" }];

  it("parte de cero si el usuario aún no tiene actividad registrada", async (t) => {
    const { repository } = buildRepository(t, { readRows: [[], [], definitions] });
    const result = await repository.getUserSummary("user-1");

    assert.deepEqual(result, {
      authId: "user-1", registeredAt: null,
      counters: { reviews: 0, comments: 0, likes: 0, friendships: 0 },
      achievements: definitions.map((definition) => ({
        ...definition, progress: 0, unlocked: false, unlockedAt: null
      }))
    });
  });

  it("combina contadores, antigüedad y fecha de desbloqueo", async (t) => {
    const registeredAt = new Date("2025-01-01T00:00:00.000Z");
    t.mock.method(Date, "now", () => registeredAt.getTime() + 60_500);
    const unlockedAt = new Date("2025-01-01T00:01:00.000Z");
    const { repository } = buildRepository(t, { readRows: [
      [{ authId: "user-1", registeredAt, reviewsCount: 3, commentsCount: 1, likesCount: 2, friendshipsCount: 0 }],
      [{ code: "reviews_3", unlockedAt }],
      definitions
    ] });

    const result = await repository.getUserSummary("user-1");
    assert.deepEqual(result.counters, { reviews: 3, comments: 1, likes: 2, friendships: 0 });
    assert.deepEqual(result.achievements, [
      { ...definitions[0], progress: 3, unlocked: true, unlockedAt },
      { ...definitions[1], progress: 60, unlocked: false, unlockedAt: null }
    ]);
  });
});
