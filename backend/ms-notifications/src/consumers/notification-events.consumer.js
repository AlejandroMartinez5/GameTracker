const amqp = require("amqplib");
const service = require("../services/notifications.service");

const EXCHANGE = "notification_events";
const QUEUE = "notification_events_queue";
const DLX = "notification_events_dlx";
const DLQ = "notification_events_dlq";

const mapReviewEvent = (event) => {
  const payload = event.payload || event;
  const templates = {
    ReviewDeleted: ["review.deleted", "Reseña eliminada", "Tu reseña fue eliminada por moderación."],
    ReviewLiked: ["review.liked", "Tu reseña recibió un like", "A alguien le gustó tu reseña."],
    ReviewCommented: ["review.commented", "Nuevo comentario en tu reseña", "Alguien comentó tu reseña."],
    CommentLiked: ["comment.liked", "Tu comentario recibió un like", "A alguien le gustó tu comentario."]
  };
  const template = templates[event.type];
  if (!template || !payload.recipientAuthId) return null;
  return {
    recipientAuthId: payload.recipientAuthId,
    actorAuthId: payload.actorAuthId,
    type: template[0], title: template[1], body: template[2],
    metadata: { ...payload, sourceEvent: event.type }
  };
};

const normalizeEvent = (event) => {
  if (event.type === "notification.created") return event.payload || {};
  return mapReviewEvent(event);
};

const consumeNotificationEvents = async () => {
  if (!process.env.RABBITMQ_URL) return;
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, "fanout", { durable: true });
    await channel.assertExchange(DLX, "direct", { durable: true });
    await channel.assertQueue(DLQ, { durable: true });
    await channel.bindQueue(DLQ, DLX, "notification.failed");
    const queue = await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX, "x-dead-letter-routing-key": "notification.failed" }
    });
    await channel.bindQueue(queue.queue, EXCHANGE, "");
    await channel.consume(queue.queue, async (message) => {
      if (!message) return;
      try {
        const notification = normalizeEvent(JSON.parse(message.content.toString()));
        if (notification) await service.createEventNotification(notification);
        channel.ack(message);
      } catch (error) {
        console.error("[ms-notifications] Error procesando evento:", error.message);
        channel.nack(message, false, false);
      }
    }, { noAck: false });
    console.log(`[ms-notifications] Escuchando ${QUEUE}`);
    connection.on("close", () => setTimeout(consumeNotificationEvents, 5000));
    connection.on("error", (error) => console.error("[ms-notifications] RabbitMQ:", error.message));
  } catch (error) {
    console.error("[ms-notifications] No se pudo conectar a RabbitMQ:", error.message);
    setTimeout(consumeNotificationEvents, 5000);
  }
};

module.exports = { consumeNotificationEvents };

