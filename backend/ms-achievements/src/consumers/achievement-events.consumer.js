const amqp = require("amqplib");
const repository = require("../repositories/achievements.repository");
const { publishAchievementUnlocked } = require("../utils/notification-events.util");

const exchanges = [
  { name: "notification_events", queue: "achievements_notification_events_queue" },
  { name: "user_events", queue: "achievements_user_events_queue" }
];

const consumeExchange = async ({ name, queue }) => {
  if (!process.env.RABBITMQ_URL) return;

  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(name, "fanout", { durable: true });
    const assertedQueue = await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(assertedQueue.queue, name, "");
    await channel.consume(assertedQueue.queue, async (message) => {
      if (!message) return;
      try {
        const result = await repository.processEvent(JSON.parse(message.content.toString()));
        for (const achievement of result.unlocked || []) {
          await publishAchievementUnlocked({
            recipientAuthId: achievement.authId,
            achievement
          });
        }
        channel.ack(message);
      } catch (error) {
        console.error(`[ms-achievements] Error procesando ${name}:`, error.message);
        channel.nack(message, false, true);
      }
    }, { noAck: false });

    console.log(`[ms-achievements] Escuchando ${name} en ${queue}`);
    connection.on("close", () => setTimeout(() => consumeExchange({ name, queue }), 5000));
    connection.on("error", (error) => console.error(`[ms-achievements] RabbitMQ ${name}:`, error.message));
  } catch (error) {
    console.error(`[ms-achievements] No se pudo conectar a ${name}:`, error.message);
    setTimeout(() => consumeExchange({ name, queue }), 5000);
  }
};

const consumeAchievementEvents = () => {
  exchanges.forEach(consumeExchange);
};

module.exports = { consumeAchievementEvents };
