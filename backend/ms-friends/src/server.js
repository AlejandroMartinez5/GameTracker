require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");

const PORT = process.env.PORT || 3006;

const startServer = async () => {
  try {
    await testConnection();

    app.listen(PORT, () => {
      console.log(`Servidor ms-friends corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar ms-friends:", error.message);
    process.exit(1);
  }
};

startServer();
