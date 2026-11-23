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
  if (connection && channel) return channel;
  if (!process.env.RABBITMQ_URL) throw new Error("RABBITMQ_URL no configurado");

  connection = await amqp.connect(process.env.RABBITMQ_URL);
  connection.on("close", resetBroker);
  connection.on("error", resetBroker);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, "fanout", { durable: true });
  return channel;
};

const publishNotification = async ({
  recipientAuthId,
  actorAuthId,
  type,
  title,
  body,
  metadata = {}
}) => {
  if (!recipientAuthId || recipientAuthId === actorAuthId) return;

  const brokerChannel = await connectBroker();
  const event = {
    eventId: crypto.randomUUID(),
    type: "notification.created",
    occurredAt: new Date().toISOString(),
    payload: {
      recipientAuthId,
      actorAuthId,
      type,
      title,
      body,
      metadata
    }
  };

  if (!brokerChannel.publish(EXCHANGE_NAME, "", Buffer.from(JSON.stringify(event)), { persistent: true })) {
    throw new Error("No se pudo publicar el evento de notificacion");
  }
};

const safePublishNotification = async (payload) => {
  try {
    await publishNotification(payload);
  } catch (error) {
    console.warn("[ms-moderation] No se pudo publicar la notificacion:", error.message);
  }
};

module.exports = { safePublishNotification };
