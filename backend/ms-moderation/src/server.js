require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");

const PORT = process.env.PORT || 3007;

const startServer = async () => {
  try {
    await testConnection();

    app.listen(PORT, () => {
      console.log(`Servidor ms-moderation corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar ms-moderation:", error.message);
    process.exit(1);
  }
};

startServer();
