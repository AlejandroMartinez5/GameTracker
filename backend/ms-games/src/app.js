const express = require('express');
const gamesRoutes = require('./routes/games.routes');

const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/games', gamesRoutes);
app.use((_req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));
app.use((error, _req, res, _next) => {
  const status = error.statusCode || error.status || (error.name === 'ValidationError' ? 400 : 500);
  res.status(status).json({ message: status >= 500 ? 'Error interno del servidor' : error.message });
});

module.exports = app;
