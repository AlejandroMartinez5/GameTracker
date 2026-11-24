const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { loadWithMocks } = require("../helpers.cjs");

const achievement = {
  code: "reviews_3", name: "Reseñista", category: "activity", metric: "reviews",
  threshold: 3, durationSeconds: null, unlockedAt: "2025-01-01T00:00:00.000Z"
};

function buildPublisher(t, publishResult = true) {
  const previous = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = "amqp://broker.test";
  t.after(() => {
    if (previous === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previous;
  });
  const channel = {
    assertExchange: t.mock.fn(async () => {}),
    publish: t.mock.fn(() => publishResult)
  };
  const connection = new EventEmitter();
  connection.createChannel = async () => channel;
  const connect = t.mock.fn(async () => connection);
  const { publishAchievementUnlocked } = loadWithMocks("utils/notification-events.util.js", {
    amqplib: { connect }
  });
  return { publishAchievementUnlocked, connect, channel };
}

describe("publishAchievementUnlocked", () => {
  it("publica una notificación persistente con los datos del logro", async (t) => {
    const { publishAchievementUnlocked, channel } = buildPublisher(t);
    await publishAchievementUnlocked({ recipientAuthId: "user-1", achievement });

    assert.deepEqual(channel.assertExchange.mock.calls[0].arguments, [
      "notification_events", "fanout", { durable: true }
    ]);
    const [exchange, key, body, options] = channel.publish.mock.calls[0].arguments;
    assert.equal(exchange, "notification_events");
    assert.equal(key, "");
    assert.deepEqual(options, { persistent: true });
    const event = JSON.parse(body.toString());
    assert.equal(event.type, "notification.created");
    assert.match(event.eventId, /^[0-9a-f-]{36}$/i);
    assert.deepEqual(event.payload, {
      recipientAuthId: "user-1", actorAuthId: null, type: "achievement.unlocked",
      title: "Logro desbloqueado", body: 'Has desbloqueado el logro "Reseñista".',
      metadata: {
        achievementCode: "reviews_3", category: "activity", metric: "reviews",
        threshold: 3, durationSeconds: null, unlockedAt: achievement.unlockedAt
      }
    });
  });

  it("omite eventos sin destinatario o sin código de logro", async (t) => {
    const { publishAchievementUnlocked, connect } = buildPublisher(t);
    await publishAchievementUnlocked({ achievement });
    await publishAchievementUnlocked({ recipientAuthId: "user-1", achievement: { name: "Reseñista" } });
    assert.equal(connect.mock.callCount(), 0);
  });

  it("registra una advertencia cuando falla la publicación", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const { publishAchievementUnlocked } = buildPublisher(t, false);
    await publishAchievementUnlocked({ recipientAuthId: "user-1", achievement });

    assert.equal(warn.mock.callCount(), 1);
    assert.equal(warn.mock.calls[0].arguments[1], "No se pudo publicar la notificacion de logro");
  });
});
