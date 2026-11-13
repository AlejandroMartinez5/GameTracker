require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");
const { consumeNotificationEvents } = require("./consumers/notification-events.consumer");
const { consumeUserEvents } = require("./consumers/user-events.consumer");
const { startNotificationsCleanupJob } = require("./services/notifications-cleanup.service");

const PORT = process.env.PORT || 3008;

const startServer = async () => {
  try {
    await testConnection();
    app.listen(PORT, () => console.log(`Servidor ms-notifications corriendo en http://localhost:${PORT}`));
    consumeNotificationEvents();
    consumeUserEvents();
    startNotificationsCleanupJob();
  } catch (error) {
    console.error("Error al iniciar ms-notifications:", error.message);
    process.exit(1);
  }
};

startServer();

