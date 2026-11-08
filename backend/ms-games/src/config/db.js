const mongoose = require('mongoose');

const MAX_RETRIES = Number(process.env.MONGO_CONNECT_RETRIES || 10);
const RETRY_DELAY_MS = Number(process.env.MONGO_CONNECT_RETRY_DELAY_MS || 5000);

async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en .env');
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('MongoDB conectado correctamente');
      return;
    } catch (error) {
      console.error(`Intento ${attempt}/${MAX_RETRIES} - Error al conectar MongoDB:`, error.message);
      if (attempt === MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

module.exports = connectDB;
