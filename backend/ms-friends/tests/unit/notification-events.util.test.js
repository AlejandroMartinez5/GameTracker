const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { loadWithMocks } = require("../helpers.cjs");

const request = { id: 42, requester_auth_id: "user-1", receiver_auth_id: "user-2" };
const details = { requestId: 42, requesterAuthId: "user-1", receiverAuthId: "user-2" };

function buildPublisher(t, publishResult = true) {
  const previousUrl = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = "amqp://broker.test";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previousUrl;
  });
  t.mock.method(console, "log", () => {});
  const channel = {
    assertExchange: t.mock.fn(async () => {}),
    publish: t.mock.fn(() => publishResult)
  };
  const connection = new EventEmitter();
  connection.createChannel = async () => channel;
  const connect = t.mock.fn(async () => connection);
  const publisher = loadWithMocks("utils/notification-events.util.js", { amqplib: { connect } });
  return { publisher, channel, connection, connect };
}

describe("notificaciones de amistad", () => {
  for (const [method, type, recipientAuthId, actorAuthId] of [
    ["publishFriendRequestReceived", "friend.request_received", "user-2", "user-1"],
    ["publishFriendRequestAccepted", "friend.request_accepted", "user-1", "user-2"],
    ["publishFriendRequestRejected", "friend.request_rejected", "user-1", "user-2"]
  ]) {
    it("publica " + type + " al destinatario correcto", async (t) => {
      const { publisher, channel } = buildPublisher(t);
      await publisher[method](request);

      assert.deepEqual(channel.assertExchange.mock.calls[0].arguments, [
        "notification_events", "fanout", { durable: true }
      ]);
      const [exchange, routingKey, body, options] = channel.publish.mock.calls[0].arguments;
      assert.equal(exchange, "notification_events");
      assert.equal(routingKey, "");
      assert.deepEqual(options, { persistent: true });
      const event = JSON.parse(body.toString());
      assert.equal(event.type, "notification.created");
      assert.match(event.eventId, /^[0-9a-f-]{36}$/i);
      assert.equal(event.payload.type, type);
      assert.equal(event.payload.recipientAuthId, recipientAuthId);
      assert.equal(event.payload.actorAuthId, actorAuthId);
      assert.deepEqual(event.payload.metadata, details);
    });
  }
});

describe("eventos de amistad", () => {
  it("publica FriendAccepted y FriendRemoved y reutiliza el canal", async (t) => {
    const { publisher, channel, connection, connect } = buildPublisher(t);
    await publisher.publishFriendAccepted(request);
    await publisher.publishFriendRemoved(request);

    const events = channel.publish.mock.calls.map((call) => JSON.parse(call.arguments[2].toString()));
    assert.deepEqual(events.map(({ type }) => type), ["FriendAccepted", "FriendRemoved"]);
    assert.deepEqual(events.map(({ payload }) => payload), [details, details]);
    assert.equal(connect.mock.callCount(), 1);

    connection.emit("close");
    await publisher.publishFriendAccepted(request);
    assert.equal(connect.mock.callCount(), 2);
  });

  it("registra los fallos del canal sin propagar el error al servicio", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const { publisher } = buildPublisher(t, false);

    await publisher.publishFriendRequestReceived(request);
    await publisher.publishFriendRemoved(request);

    assert.deepEqual(warn.mock.calls.map((call) => call.arguments[1]), [
      "No se pudo publicar el evento de notificacion",
      "No se pudo publicar el evento de amistad"
    ]);
  });
});
