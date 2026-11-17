const app = require("./app");
const { testConnection } = require("./config/db");

const port = process.env.PORT || 3010;

const startServer = async () => {
  try {
    await testConnection();

    app.listen(port, () => {
      console.log(
        `Servidor ms-user-library corriendo en http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

startServer();
