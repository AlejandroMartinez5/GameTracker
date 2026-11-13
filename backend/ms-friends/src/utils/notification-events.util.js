const amqp = require("amqplib");

const EXCHANGE_NAME = "notification_events";
const EXCHANGE_TYPE = "fanout";

const FRIEND_NOTIFICATION_TYPES = {
  REQUEST_RECEIVED: "friend.request_received",
  REQUEST_ACCEPTED: "friend.request_accepted",
  REQUEST_REJECTED: "friend.request_rejected"
};

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

  console.log("[ms-friends] Conectado a RabbitMQ para notificaciones");
  return { connection, channel };
};

const publishNotificationEvent = async (payload) => {
  const { channel: brokerChannel } = await connectBroker();
  const event = {
    type: "notification.created",
    payload
  };

  const sent = brokerChannel.publish(
    EXCHANGE_NAME,
    "",
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true
    }
  );

  if (!sent) {
    throw new Error("No se pudo publicar el evento de notificacion");
  }

  console.log("[ms-friends] Evento de notificacion publicado:", payload.type);
};

const safePublishNotificationEvent = async (payload) => {
  try {
    await publishNotificationEvent(payload);
  } catch (error) {
    console.warn(
      "[ms-friends] No se pudo publicar la notificacion:",
      error.message
    );
  }
};

const publishFriendRequestReceived = async (request) => {
  return safePublishNotificationEvent({
    recipientAuthId: request.receiver_auth_id,
    actorAuthId: request.requester_auth_id,
    type: FRIEND_NOTIFICATION_TYPES.REQUEST_RECEIVED,
    title: "Nueva solicitud de amistad",
    body: "Tienes una nueva solicitud de amistad.",
    metadata: {
      requestId: request.id,
      requesterAuthId: request.requester_auth_id,
      receiverAuthId: request.receiver_auth_id
    }
  });
};

const publishFriendRequestAccepted = async (request) => {
  return safePublishNotificationEvent({
    recipientAuthId: request.requester_auth_id,
    actorAuthId: request.receiver_auth_id,
    type: FRIEND_NOTIFICATION_TYPES.REQUEST_ACCEPTED,
    title: "Solicitud de amistad aceptada",
    body: "Tu solicitud de amistad fue aceptada.",
    metadata: {
      requestId: request.id,
      requesterAuthId: request.requester_auth_id,
      receiverAuthId: request.receiver_auth_id
    }
  });
};

const publishFriendRequestRejected = async (request) => {
  return safePublishNotificationEvent({
    recipientAuthId: request.requester_auth_id,
    actorAuthId: request.receiver_auth_id,
    type: FRIEND_NOTIFICATION_TYPES.REQUEST_REJECTED,
    title: "Solicitud de amistad rechazada",
    body: "Tu solicitud de amistad fue rechazada.",
    metadata: {
      requestId: request.id,
      requesterAuthId: request.requester_auth_id,
      receiverAuthId: request.receiver_auth_id
    }
  });
};

module.exports = {
  publishFriendRequestReceived,
  publishFriendRequestAccepted,
  publishFriendRequestRejected,
  FRIEND_NOTIFICATION_TYPES
};