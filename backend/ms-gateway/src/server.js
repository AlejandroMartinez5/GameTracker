require("dotenv").config();

const { app } = require("./app");

const port = Number(process.env.PORT || 8080);

app.listen(port, () => {
  console.log(`API Gateway corriendo en http://localhost:${port}`);
});
