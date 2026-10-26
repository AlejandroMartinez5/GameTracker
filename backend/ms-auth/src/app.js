const express = require('express');
const app = express();
app.use(express.json());


app.get('/health', (_req, res) => {
  const connected = require('mongoose').connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
});

app.use('/api/auth', require('./routes/auth.routes'));

app.use((_req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

app.use((error, _req, res, _next) => {
  const status = error.statusCode || error.status || (error.name === 'ValidationError' ? 400 : 500);
  res.status(status).json({ message: status >= 500 ? 'Error interno del servidor' : error.message });
});
module.exports = app;
