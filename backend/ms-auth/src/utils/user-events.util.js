const crypto = require("node:crypto");
const amqp = require("amqplib");

const EXCHANGE_NAME = "user_events";
const NOTIFICATION_EXCHANGE_NAME = "notification_events";

let connection = null;
let channel = null;

const resetBroker = () => {
  connection = null;
  channel = null;
};

const connectBroker = async () => {
  if (connection && channel) return channel;

  if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL no configurado");
  }

  connection = await amqp.connect(process.env.RABBITMQ_URL);
  connection.on("close", resetBroker);
  connection.on("error", resetBroker);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, "fanout", { durable: true });
  await channel.assertExchange(NOTIFICATION_EXCHANGE_NAME, "fanout", { durable: true });

  return channel;
};

const safePublish = async (type, payload, exchangeName = EXCHANGE_NAME) => {
  try {
    const brokerChannel = await connectBroker();
    const event = {
      eventId: crypto.randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      payload
    };

    brokerChannel.publish(
      exchangeName,
      "",
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );
  } catch (error) {
    console.warn(`[ms-auth] No se pudo publicar ${type}: ${error.message}`);
  }
};

const publishUserCreated = (user) => safePublish("user.created", {
  authId: String(user._id),
  email: user.email,
  role: user.role,
  name: user.name,
  username: user.username,
  emailVerified: user.emailVerified
});

const publishEmailVerified = (user) => safePublish("user.email_verified", {
  authId: String(user._id),
  email: user.email,
  username: user.username,
  emailVerified: true
});

const publishUsernameUpdated = (user) => safePublish("user.username_updated", {
  authId: String(user._id),
  username: user.username
});

const publishPasswordChanged = (userId) => safePublish("user.password_changed", {
  authId: String(userId)
});

const publishPasswordReset = (userId) => safePublish("user.password_reset", {
  authId: String(userId)
});

const publishModerationNotification = ({ recipientAuthId, actorAuthId, type, title, body, metadata = {} }) => {
  if (!recipientAuthId || String(recipientAuthId) === String(actorAuthId)) return Promise.resolve();

  return safePublish("notification.created", {
    recipientAuthId: String(recipientAuthId),
    actorAuthId: actorAuthId ? String(actorAuthId) : null,
    type,
    title,
    body,
    metadata
  }, NOTIFICATION_EXCHANGE_NAME);
};

module.exports = {
  publishUserCreated,
  publishEmailVerified,
  publishUsernameUpdated,
  publishPasswordChanged,
  publishPasswordReset,
  publishModerationNotification
};
