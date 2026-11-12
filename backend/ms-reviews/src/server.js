require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");
const { verifyToken } = require("./utils/jwt.util");

const PORT = process.env.PORT || 3005;

// Sin la llave pública todos los tokens serían rechazados en silencio,
// así que se detecta al arrancar y no hasta la primera petición.
const assertPublicKeyAvailable = () => {
  try {
    verifyToken("verificacion-de-arranque");
  } catch (error) {
    if (/llave p[uú]blica/i.test(error.message)) {
      throw error;
    }
  }
};

const startServer = async () => {
  try {
    assertPublicKeyAvailable();
    await testConnection();

    app.listen(PORT, () => {
      console.log(`Servidor ms-reviews corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar ms-reviews:", error.message);
    process.exit(1);
  }
};

startServer();
