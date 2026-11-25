const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { loadWithMocks } = require("../helpers.cjs");

async function startConsumer(t, handler = async () => ({})) {
  const previous = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = "amqp://broker.test";
  t.after(() => {
    if (previous === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previous;
  });
  const log = t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const subscriptions = new Map();
  const channel = {
    assertExchange: t.mock.fn(async () => {}),
    assertQueue: t.mock.fn(async (queue) => ({ queue })),
    bindQueue: t.mock.fn(async () => {}),
    consume: t.mock.fn(async (queue, receive) => { subscriptions.set(queue, receive); }),
    ack: t.mock.fn(),
    nack: t.mock.fn()
  };
  const processEvent = t.mock.fn(handler);
  const publishAchievementUnlocked = t.mock.fn(async () => {
    assert.equal(channel.ack.mock.callCount(), 0);
  });
  const { consumeAchievementEvents } = loadWithMocks("consumers/achievement-events.consumer.js", {
    amqplib: { connect: async () => Object.assign(new EventEmitter(), { createChannel: async () => channel }) },
    "../repositories/achievements.repository": { processEvent },
    "../utils/notification-events.util": { publishAchievementUnlocked }
  });

  consumeAchievementEvents();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(log.mock.callCount(), 2);
  return { channel, subscriptions, processEvent, publishAchievementUnlocked };
}

const queue = "achievements_notification_events_queue";
const messageFor = (event) => ({ content: Buffer.from(JSON.stringify(event)) });

describe("consumeAchievementEvents", () => {
  it("se suscribe a eventos de notificación y de usuario con confirmación manual", async (t) => {
    const { channel } = await startConsumer(t);
    for (const exchange of ["notification_events", "user_events"]) {
      const name = "achievements_" + exchange + "_queue";
      assert.ok(channel.assertExchange.mock.calls.some((call) =>
        call.arguments[0] === exchange && call.arguments[1] === "fanout" && call.arguments[2].durable));
      const binding = channel.bindQueue.mock.calls.find((call) => call.arguments[0] === name);
      assert.deepEqual(binding.arguments, [name, exchange, ""]);
      const subscription = channel.consume.mock.calls.find((call) => call.arguments[0] === name);
      assert.deepEqual(subscription.arguments[2], { noAck: false });
    }
  });

  it("publica cada logro desbloqueado antes de confirmar el mensaje", async (t) => {
    const unlocked = [{ authId: "user-1", code: "friends" }, { authId: "user-2", code: "friends" }];
    const { channel, subscriptions, processEvent, publishAchievementUnlocked } =
      await startConsumer(t, async () => ({ unlocked }));
    const event = { eventId: "evt-1", type: "FriendAccepted" };
    const message = messageFor(event);

    await subscriptions.get(queue)(message);

    assert.deepEqual(processEvent.mock.calls[0].arguments, [event]);
    assert.deepEqual(publishAchievementUnlocked.mock.calls.map((call) => call.arguments[0]),
      unlocked.map((achievement) => ({ recipientAuthId: achievement.authId, achievement })));
    assert.deepEqual(channel.ack.mock.calls[0].arguments, [message]);
  });

  it("confirma un evento duplicado sin publicar otra notificación", async (t) => {
    const { channel, subscriptions, publishAchievementUnlocked } =
      await startConsumer(t, async () => ({ processed: false, duplicate: true }));
    const message = messageFor({ eventId: "evt-1", type: "user.created" });

    await subscriptions.get("achievements_user_events_queue")(message);

    assert.deepEqual(channel.ack.mock.calls[0].arguments, [message]);
    assert.equal(publishAchievementUnlocked.mock.callCount(), 0);
  });

  it("solicita el reencolado si falla el procesamiento", async (t) => {
    const { channel, subscriptions, publishAchievementUnlocked } = await startConsumer(t, async () => {
      throw new Error("Base de datos no disponible");
    });
    const message = messageFor({ eventId: "evt-1", type: "ReviewCreated" });

    await subscriptions.get(queue)(message);

    assert.equal(channel.ack.mock.callCount(), 0);
    assert.equal(publishAchievementUnlocked.mock.callCount(), 0);
    assert.deepEqual(channel.nack.mock.calls[0].arguments, [message, false, true]);
  });
});
