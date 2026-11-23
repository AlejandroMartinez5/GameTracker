require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");
const { consumeAchievementEvents } = require("./consumers/achievement-events.consumer");
const { startTenureEvaluation } = require("./services/achievements.service");

const PORT = process.env.PORT || 3011;

const startServer = async () => {
  try {
    await testConnection();
    app.listen(PORT, () => console.log(`Servidor ms-achievements corriendo en http://localhost:${PORT}`));
    consumeAchievementEvents();
    startTenureEvaluation();
  } catch (error) {
    console.error("Error al iniciar ms-achievements:", error.message);
    process.exit(1);
  }
};

startServer();
