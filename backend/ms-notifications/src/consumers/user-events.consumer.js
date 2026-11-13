const amqp = require("amqplib");
const service = require("../services/notifications.service");

const EXCHANGE = "user_events";
const QUEUE = "notifications_user_events_queue";

const templates = {
  "user.created": ["user.welcome", "Bienvenido a GameTracker", (p) => `Hola ${p.username?.trim() || "usuario"}, tu cuenta está lista.`],
  "user.email_verified": ["user.email_verified", "Correo verificado", () => "Tu correo fue verificado correctamente."],
  "user.username_updated": ["user.username_updated", "Username actualizado", (p) => `Tu username ahora es ${p.username || ""}.`],
  "user.password_changed": ["user.password_changed", "Contraseña actualizada", () => "Tu contraseña fue actualizada correctamente."],
  "user.password_reset": ["user.password_reset", "Contraseña restablecida", () => "Tu contraseña fue restablecida correctamente."]
};

const consumeUserEvents = async () => {
  if (!process.env.RABBITMQ_URL) return;
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, "fanout", { durable: true });
    const queue = await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(queue.queue, EXCHANGE, "");
    await channel.consume(queue.queue, async (message) => {
      if (!message) return;
      try {
        const event = JSON.parse(message.content.toString());
        const payload = event.payload || event;
        const template = templates[event.type];
        if (template && (event.type !== "user.email_verified" || payload.emailVerified)) {
          await service.createEventNotification({
            recipientAuthId: payload.authId,
            type: template[0], title: template[1], body: template[2](payload),
            metadata: { sourceEvent: event.type }
          });
        }
        channel.ack(message);
      } catch (error) {
        console.error("[ms-notifications] Error procesando user event:", error.message);
        channel.nack(message, false, true);
      }
    }, { noAck: false });
    console.log(`[ms-notifications] Escuchando ${QUEUE}`);
    connection.on("close", () => setTimeout(consumeUserEvents, 5000));
  } catch (error) {
    console.error("[ms-notifications] No se pudo conectar a user_events:", error.message);
    setTimeout(consumeUserEvents, 5000);
  }
};

module.exports = { consumeUserEvents };

