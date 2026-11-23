const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const { loadWithMocks } = require("../helpers.cjs");

const notificationConsumer = ["notification-events.consumer.js", "consumeNotificationEvents"];
const userConsumer = ["user-events.consumer.js", "consumeUserEvents"];
const messageFor = (event) => ({ content: Buffer.from(JSON.stringify(event)) });

async function startConsumer(t, [file, entrypoint], persist = async () => {}) {
  const previousUrl = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = "amqp://broker.test";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previousUrl;
  });
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});

  const channel = {
    assertExchange: t.mock.fn(async () => {}),
    assertQueue: t.mock.fn(async (queue) => ({ queue })),
    bindQueue: t.mock.fn(async () => {}),
    consume: t.mock.fn(async () => {}),
    ack: t.mock.fn(),
    nack: t.mock.fn()
  };
  const connection = new EventEmitter();
  connection.createChannel = async () => channel;
  const createEventNotification = t.mock.fn(persist);
  const consumer = loadWithMocks(path.join(__dirname, "../../src/consumers", file), {
    amqplib: { connect: async () => connection },
    "../services/notifications.service": { createEventNotification }
  });
  await consumer[entrypoint]();
  const [, receive, options] = channel.consume.mock.calls[0].arguments;
  assert.deepEqual(options, { noAck: false });
  return { channel, receive, createEventNotification };
}

describe("consumeNotificationEvents", () => {
  it("configura la cola de descarte y su enlace", async (t) => {
    const { channel } = await startConsumer(t, notificationConsumer);

    assert.deepEqual(channel.assertExchange.mock.calls.map(({ arguments: args }) => args), [
      ["notification_events", "fanout", { durable: true }],
      ["notification_events_dlx", "direct", { durable: true }]
    ]);
    assert.deepEqual(channel.assertQueue.mock.calls[1].arguments, [
      "notification_events_queue",
      {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "notification_events_dlx",
          "x-dead-letter-routing-key": "notification.failed"
        }
      }
    ]);
    assert.deepEqual(channel.bindQueue.mock.calls[0].arguments, [
      "notification_events_dlq", "notification_events_dlx", "notification.failed"
    ]);
    assert.deepEqual(channel.bindQueue.mock.calls[1].arguments, [
      "notification_events_queue", "notification_events", ""
    ]);
  });

  it("persiste el evento genérico con su identificador y confirma el mensaje", async (t) => {
    const { channel, receive, createEventNotification } = await startConsumer(t, notificationConsumer);
    const payload = { recipientAuthId: "user-1", type: "report.created" };
    const message = messageFor({ type: "notification.created", eventId: "evt-1", payload });

    await receive(message);

    assert.deepEqual(createEventNotification.mock.calls[0].arguments, [{ ...payload, eventId: "evt-1" }]);
    assert.deepEqual(channel.ack.mock.calls[0].arguments, [message]);
    assert.equal(channel.nack.mock.callCount(), 0);
  });

  for (const [sourceEvent, type] of [
    ["ReviewDeleted", "review.deleted"], ["ReviewLiked", "review.liked"],
    ["ReviewCommented", "review.commented"], ["CommentLiked", "comment.liked"]
  ]) {
    it("convierte " + sourceEvent + " en una notificación", async (t) => {
      const { channel, receive, createEventNotification } = await startConsumer(t, notificationConsumer);
      const payload = { recipientAuthId: "user-1", actorAuthId: "user-2", reviewId: 7 };
      const message = messageFor({ type: sourceEvent, eventId: "evt-2", payload });

      await receive(message);

      const [notification] = createEventNotification.mock.calls[0].arguments;
      assert.equal(notification.type, type);
      assert.equal(notification.recipientAuthId, payload.recipientAuthId);
      assert.equal(notification.actorAuthId, payload.actorAuthId);
      assert.equal(notification.eventId, "evt-2");
      assert.deepEqual(notification.metadata, { ...payload, sourceEvent });
      assert.equal(channel.ack.mock.callCount(), 1);
    });
  }

  it("confirma eventos desconocidos sin crear notificaciones", async (t) => {
    const { channel, receive, createEventNotification } = await startConsumer(t, notificationConsumer);

    await receive(messageFor({ type: "unknown" }));

    assert.equal(createEventNotification.mock.callCount(), 0);
    assert.equal(channel.ack.mock.callCount(), 1);
  });

  it("rechaza JSON inválido sin reenviarlo a la cola principal", async (t) => {
    const { channel, receive, createEventNotification } = await startConsumer(t, notificationConsumer);
    const message = { content: Buffer.from("{") };

    await receive(message);

    assert.equal(createEventNotification.mock.callCount(), 0);
    assert.equal(channel.ack.mock.callCount(), 0);
    assert.deepEqual(channel.nack.mock.calls[0].arguments, [message, false, false]);
  });
});

describe("consumeUserEvents", () => {
  for (const [sourceEvent, type] of [
    ["user.created", "user.welcome"], ["user.email_verified", "user.email_verified"],
    ["user.username_updated", "user.username_updated"],
    ["user.password_changed", "user.password_changed"], ["user.password_reset", "user.password_reset"]
  ]) {
    it("convierte " + sourceEvent + " y confirma el mensaje", async (t) => {
      const { channel, receive, createEventNotification } = await startConsumer(t, userConsumer);
      const message = messageFor({
        type: sourceEvent, eventId: "evt-3",
        payload: { authId: "user-1", username: "ana", emailVerified: true }
      });

      await receive(message);

      const [notification] = createEventNotification.mock.calls[0].arguments;
      assert.equal(notification.recipientAuthId, "user-1");
      assert.equal(notification.type, type);
      assert.equal(notification.eventId, "evt-3");
      assert.deepEqual(notification.metadata, { sourceEvent });
      assert.ok(notification.title);
      assert.ok(notification.body);
      assert.deepEqual(channel.ack.mock.calls[0].arguments, [message]);
    });
  }

  it("omite la notificación de correo si la cuenta sigue sin verificar", async (t) => {
    const { channel, receive, createEventNotification } = await startConsumer(t, userConsumer);
    const message = messageFor({
      type: "user.email_verified", payload: { authId: "user-1", emailVerified: false }
    });

    await receive(message);

    assert.equal(createEventNotification.mock.callCount(), 0);
    assert.equal(channel.ack.mock.callCount(), 1);
  });
});

for (const [consumer, event, requeue] of [
  [notificationConsumer, { type: "notification.created", payload: { recipientAuthId: "user-1" } }, false],
  [userConsumer, { type: "user.created", payload: { authId: "user-1" } }, true]
]) {
  it(consumer[1] + " aplica su política de reencolado si falla la persistencia", async (t) => {
    const { channel, receive } = await startConsumer(t, consumer, async () => {
      throw new Error("Base de datos no disponible");
    });
    const message = messageFor(event);

    await receive(message);

    assert.equal(channel.ack.mock.callCount(), 0);
    assert.deepEqual(channel.nack.mock.calls[0].arguments, [message, false, requeue]);
  });
}
