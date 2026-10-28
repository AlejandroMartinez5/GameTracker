require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const app = require('./app');
const User = require('./models/user.model');


const start = async () => {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en .env');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await User.init();
  const server = app.listen(process.env.PORT || 3003);
  server.on('error', async error => {
    console.error('Error del servidor:', error.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  });
  server.on('listening', () => console.log(`ms-auth escuchando en el puerto ${server.address().port}`));
};

start().catch(async error => {
  console.error('Error al iniciar ms-auth:', error.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
