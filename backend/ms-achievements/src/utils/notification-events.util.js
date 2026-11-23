const crypto = require("node:crypto");
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

const publishAchievementUnlocked = async ({ recipientAuthId, achievement }) => {
  if (!recipientAuthId || !achievement?.code) return;

  try {
    const brokerChannel = await connectBroker();
    const event = {
      eventId: crypto.randomUUID(),
      type: "notification.created",
      occurredAt: new Date().toISOString(),
      payload: {
        recipientAuthId: String(recipientAuthId),
        actorAuthId: null,
        type: "achievement.unlocked",
        title: "Logro desbloqueado",
        body: `Has desbloqueado el logro "${achievement.name}".`,
        metadata: {
          achievementCode: achievement.code,
          category: achievement.category,
          metric: achievement.metric,
          threshold: achievement.threshold,
          durationSeconds: achievement.durationSeconds,
          unlockedAt: achievement.unlockedAt
        }
      }
    };

    if (!brokerChannel.publish(EXCHANGE_NAME, "", Buffer.from(JSON.stringify(event)), { persistent: true })) {
      throw new Error("No se pudo publicar la notificacion de logro");
    }
  } catch (error) {
    console.warn("[ms-achievements] No se pudo publicar la notificacion de logro:", error.message);
  }
};

module.exports = { publishAchievementUnlocked };
