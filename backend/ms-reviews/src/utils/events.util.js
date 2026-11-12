const crypto = require("crypto");
const amqp = require("amqplib");

const EXCHANGE_NAME = "notification_events";

let connection = null;
let channel = null;

const resetBroker = () => {
  connection = null;
  channel = null;
};

const connectBroker = async () => {
  if (connection && channel) {
    return channel;
  }

  if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL no configurado");
  }

  connection = await amqp.connect(process.env.RABBITMQ_URL);
  connection.on("close", resetBroker);
  connection.on("error", resetBroker);

  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, "fanout", { durable: true });

  console.log("[ms-reviews] Conectado a RabbitMQ");
  return channel;
};

// Los eventos son complementarios: si RabbitMQ falla, solo se registra una
// advertencia y la operacion principal nunca se bloquea ni se revierte.
const safePublish = async (type, payload) => {
  try {
    if (payload.recipientAuthId && payload.recipientAuthId === payload.actorAuthId) {
      return;
    }

    const brokerChannel = await connectBroker();
    const event = {
      eventId: crypto.randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      payload
    };

    const sent = brokerChannel.publish(
      EXCHANGE_NAME,
      "",
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );

    if (!sent) {
      throw new Error("No se pudo publicar el evento");
    }

    console.log(`[ms-reviews] Evento publicado: ${type}`);
  } catch (error) {
    console.warn(`[ms-reviews] No se pudo publicar ${type}: ${error.message}`);
  }
};

const publishReviewCreated = ({ review }) => {
  return safePublish("ReviewCreated", {
    actorAuthId: review.auth_id,
    reviewId: review.id,
    igdbId: review.igdb_id
  });
};

const publishReviewDeleted = ({ review, actorAuthId }) => {
  return safePublish("ReviewDeleted", {
    actorAuthId,
    recipientAuthId: review.auth_id,
    reviewId: review.id,
    igdbId: review.igdb_id
  });
};

const publishReviewLiked = ({ review, actorAuthId }) => {
  return safePublish("ReviewLiked", {
    actorAuthId,
    recipientAuthId: review.auth_id,
    reviewId: review.id,
    igdbId: review.igdb_id
  });
};

const publishReviewCommented = ({ review, comment }) => {
  return safePublish("ReviewCommented", {
    actorAuthId: comment.auth_id,
    recipientAuthId: review.auth_id,
    reviewId: review.id,
    commentId: comment.id,
    igdbId: review.igdb_id
  });
};

const publishCommentLiked = ({ comment, actorAuthId }) => {
  return safePublish("CommentLiked", {
    actorAuthId,
    recipientAuthId: comment.auth_id,
    commentId: comment.id,
    reviewId: comment.review_id
  });
};

module.exports = {
  publishReviewCreated,
  publishReviewDeleted,
  publishReviewLiked,
  publishReviewCommented,
  publishCommentLiked
};
