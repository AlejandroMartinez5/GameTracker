const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const amqp = require("amqplib");

const events = require("../../src/utils/events.util");
const { makeReview, makeComment, AUTH_ID, OTHER_AUTH_ID } = require("../helpers");

// Simula una conexión a RabbitMQ. La conexión queda cacheada dentro del
// módulo, por eso cada prueba dispara "close" al terminar para reiniciarla.
const createFakeBroker = ({ publishResult = true } = {}) => {
  const handlers = {};
  const channel = {
    assertExchange: mock.fn(async () => {}),
    publish: mock.fn(() => publishResult)
  };
  const connection = {
    on: (event, handler) => {
      handlers[event] = handler;
    },
    createChannel: mock.fn(async () => channel)
  };

  return { channel, connection, close: () => handlers.close?.() };
};

const lastEvent = (channel) => {
  const call = channel.publish.mock.calls.at(-1);
  return JSON.parse(call.arguments[2].toString());
};

describe("events.util", () => {
  let broker;

  beforeEach(() => {
    process.env.RABBITMQ_URL = "amqp://test";
    broker = createFakeBroker();
    mock.method(amqp, "connect", async () => broker.connection);
    mock.method(console, "log", () => {});
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    broker.close();
    mock.restoreAll();
    delete process.env.RABBITMQ_URL;
  });

  it("publishReviewCreated publica en el exchange fanout", async () => {
    await events.publishReviewCreated({ review: makeReview() });

    assert.deepEqual(broker.channel.assertExchange.mock.calls[0].arguments, [
      "notification_events",
      "fanout",
      { durable: true }
    ]);

    const [exchange, routingKey, , options] = broker.channel.publish.mock.calls[0].arguments;
    assert.equal(exchange, "notification_events");
    assert.equal(routingKey, "");
    assert.deepEqual(options, { persistent: true });

    const event = lastEvent(broker.channel);
    assert.equal(event.type, "ReviewCreated");
    assert.match(event.eventId, /^[0-9a-f-]{36}$/);
    assert.ok(!Number.isNaN(Date.parse(event.occurredAt)));
    assert.deepEqual(event.payload, { actorAuthId: AUTH_ID, reviewId: 1, igdbId: 1942 });
  });

  it("reutiliza la conexión entre publicaciones", async () => {
    const review = makeReview();
    await events.publishReviewLiked({ review, actorAuthId: OTHER_AUTH_ID });
    await events.publishReviewLiked({ review, actorAuthId: OTHER_AUTH_ID });

    assert.equal(amqp.connect.mock.callCount(), 1);
    assert.equal(broker.channel.publish.mock.callCount(), 2);
  });

  it("no notifica cuando el actor es el mismo destinatario", async () => {
    await events.publishReviewLiked({ review: makeReview(), actorAuthId: AUTH_ID });

    assert.equal(amqp.connect.mock.callCount(), 0);
  });

  it("arma el payload de ReviewCommented y CommentLiked", async () => {
    const review = makeReview();
    await events.publishReviewCommented({
      review,
      comment: makeComment({ auth_id: OTHER_AUTH_ID })
    });
    assert.deepEqual(lastEvent(broker.channel).payload, {
      actorAuthId: OTHER_AUTH_ID,
      recipientAuthId: AUTH_ID,
      reviewId: 1,
      commentId: 10,
      igdbId: 1942
    });

    await events.publishCommentLiked({ comment: makeComment(), actorAuthId: OTHER_AUTH_ID });
    assert.deepEqual(lastEvent(broker.channel), {
      ...lastEvent(broker.channel),
      type: "CommentLiked",
      payload: { actorAuthId: OTHER_AUTH_ID, recipientAuthId: AUTH_ID, commentId: 10, reviewId: 1 }
    });
  });

  it("publishReviewDeleted incluye al destinatario", async () => {
    await events.publishReviewDeleted({ review: makeReview(), actorAuthId: OTHER_AUTH_ID });

    assert.equal(lastEvent(broker.channel).type, "ReviewDeleted");
    assert.equal(lastEvent(broker.channel).payload.recipientAuthId, AUTH_ID);
  });

  it("no lanza error si falta RABBITMQ_URL", async () => {
    delete process.env.RABBITMQ_URL;

    await events.publishReviewCreated({ review: makeReview() });

    assert.equal(amqp.connect.mock.callCount(), 0);
    assert.match(console.warn.mock.calls[0].arguments[0], /RABBITMQ_URL no configurado/);
  });

  it("no lanza error si RabbitMQ no está disponible", async () => {
    amqp.connect.mock.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });

    await events.publishReviewCreated({ review: makeReview() });

    assert.match(console.warn.mock.calls[0].arguments[0], /ECONNREFUSED/);
  });

  it("registra advertencia si publish devuelve false", async () => {
    broker.channel.publish.mock.mockImplementation(() => false);

    await events.publishReviewCreated({ review: makeReview() });

    assert.match(console.warn.mock.calls[0].arguments[0], /No se pudo publicar el evento/);
  });
});
