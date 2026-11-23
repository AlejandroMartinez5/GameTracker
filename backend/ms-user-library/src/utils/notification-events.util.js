const crypto = require("crypto");
const amqp = require("amqplib");

const EXCHANGE_NAME = "notification_events";
const EXCHANGE_TYPE = "fanout";

let connection = null;
let channel = null;

const resetBroker = () => {
  connection = null;
  channel = null;
};

const connectBroker = async () => {
  if (connection && channel) {
    return { connection, channel };
  }

  if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL no configurado");
  }

  connection = await amqp.connect(process.env.RABBITMQ_URL);
  connection.on("close", resetBroker);
  connection.on("error", resetBroker);

  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
    durable: true
  });

  console.log("[ms-user-library] Conectado a RabbitMQ para notificaciones");
  return { connection, channel };
};

const safePublishNotificationEvent = async (payload) => {
  try {
    const { channel: brokerChannel } = await connectBroker();
    const event = {
      eventId: crypto.randomUUID(),
      type: "notification.created",
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
      throw new Error("No se pudo publicar el evento de notificacion");
    }

    console.log("[ms-user-library] Evento de notificacion publicado:", payload.type);
  } catch (error) {
    console.warn(
      "[ms-user-library] No se pudo publicar la notificacion:",
      error.message
    );
  }
};

const publishFavoriteAdded = async ({ authId, igdbId }) => {
  return safePublishNotificationEvent({
    recipientAuthId: authId,
    type: "library.favorite_added",
    title: "Agregado a favoritos",
    body: "Se agrego un juego a tus favoritos.",
    metadata: { igdbId }
  });
};

module.exports = {
  publishFavoriteAdded
};
