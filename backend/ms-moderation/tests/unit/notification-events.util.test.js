const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const { loadWithMocks } = require("../helpers");

const filename = path.join(__dirname, "../../src/utils/notification-events.util.js");
const brokerUrl = "amqp://broker.test";
const payload = {
  recipientAuthId: "reporter-auth",
  actorAuthId: "admin-1",
  type: "report.dismissed",
  title: "Reporte descartado",
  body: "Tu reporte fue revisado.",
  metadata: { reportId: 10 }
};

function buildPublisher(t, { publishResult = true, connectError } = {}) {
  const previousUrl = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = brokerUrl;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previousUrl;
  });

  const channel = {
    assertExchange: t.mock.fn(async () => {}),
    publish: t.mock.fn(() => publishResult)
  };
  const connection = new EventEmitter();
  connection.createChannel = t.mock.fn(async () => channel);
  const connect = t.mock.fn(async () => {
    if (connectError) throw connectError;
    return connection;
  });
  const { safePublishNotification } = loadWithMocks(filename, { amqplib: { connect } });
  return { safePublishNotification, channel, connection, connect };
}

describe("safePublishNotification", () => {
  it("publica un evento persistente en el exchange de notificaciones", async (t) => {
    const { safePublishNotification, connect, channel } = buildPublisher(t);

    await safePublishNotification(payload);

    assert.deepEqual(connect.mock.calls[0].arguments, [brokerUrl]);
    assert.deepEqual(channel.assertExchange.mock.calls[0].arguments, [
      "notification_events", "fanout", { durable: true }
    ]);
    const [exchange, routingKey, body, options] = channel.publish.mock.calls[0].arguments;
    assert.equal(exchange, "notification_events");
    assert.equal(routingKey, "");
    assert.deepEqual(options, { persistent: true });
    assert.ok(Buffer.isBuffer(body));
    const event = JSON.parse(body.toString());
    assert.equal(event.type, "notification.created");
    assert.match(event.eventId, /^[0-9a-f-]{36}$/i);
    assert.equal(new Date(event.occurredAt).toISOString(), event.occurredAt);
    assert.deepEqual(event.payload, payload);
  });

  it("reutiliza el canal y vuelve a conectar cuando se cierra la conexión", async (t) => {
    const { safePublishNotification, connect, connection, channel } = buildPublisher(t);

    await safePublishNotification(payload);
    await safePublishNotification(payload);
    assert.equal(connect.mock.callCount(), 1);
    connection.emit("close");
    await safePublishNotification(payload);

    assert.equal(connect.mock.callCount(), 2);
    assert.equal(channel.publish.mock.callCount(), 3);
  });

  it("omite publicaciones sin destinatario o dirigidas al propio actor", async (t) => {
    const { safePublishNotification, connect } = buildPublisher(t);

    await safePublishNotification({ ...payload, recipientAuthId: null });
    await safePublishNotification({ ...payload, recipientAuthId: payload.actorAuthId });

    assert.equal(connect.mock.callCount(), 0);
  });

  for (const [name, options, message] of [
    ["la conexión falla", { connectError: new Error("Broker no disponible") }, "Broker no disponible"],
    ["el canal devuelve false", { publishResult: false }, "No se pudo publicar el evento de notificacion"]
  ]) {
    it("registra una advertencia si " + name, async (t) => {
      const warn = t.mock.method(console, "warn", () => {});
      const { safePublishNotification } = buildPublisher(t, options);

      await safePublishNotification(payload);

      assert.equal(warn.mock.callCount(), 1);
      assert.equal(warn.mock.calls[0].arguments[1], message);
    });
  }
});
