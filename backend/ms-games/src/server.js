require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');

async function start() {
  await connectDB();
  const server = app.listen(process.env.PORT || 3009);
  server.on('error', async error => {
    console.error('Error del servidor:', error.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  });
  server.on('listening', () => console.log(`ms-games escuchando en el puerto ${server.address().port}`));
}

start().catch(async error => {
  console.error('Error al iniciar ms-games:', error.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
