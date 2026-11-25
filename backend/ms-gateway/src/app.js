const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const serviceTargets = {
  auth: process.env.AUTH_SERVICE_URL || "http://127.0.0.1:3003",
  games: process.env.GAMES_SERVICE_URL || "http://127.0.0.1:3009",
  friends: process.env.FRIENDS_SERVICE_URL || "http://127.0.0.1:3006",
  library: process.env.USER_LIBRARY_SERVICE_URL || "http://127.0.0.1:3010",
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || "http://127.0.0.1:3008",
  achievements: process.env.ACHIEVEMENTS_SERVICE_URL || "http://127.0.0.1:3011",
  reviews: process.env.REVIEWS_SERVICE_URL || "http://127.0.0.1:3005",
  moderation: process.env.MODERATION_SERVICE_URL || "http://127.0.0.1:3007"
};

const isPathFor = (prefix) => (path) => {
  const pathname = path.split("?", 1)[0];
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const serviceRoutes = [
  { prefix: "/api/auth", target: serviceTargets.auth },
  { prefix: "/api/games", target: serviceTargets.games },
  { prefix: "/api/friends", target: serviceTargets.friends },
  { prefix: "/api/favorites", target: serviceTargets.library },
  { prefix: "/api/notifications", target: serviceTargets.notifications },
  { prefix: "/api/achievements", target: serviceTargets.achievements },
  { prefix: "/api/reviews", target: serviceTargets.reviews },
  { prefix: "/api/comments", target: serviceTargets.reviews },
  { prefix: "/api/leaderboards", target: serviceTargets.reviews },
  { prefix: "/api/moderation", target: serviceTargets.moderation }
];

const findServiceRoute = (path) => serviceRoutes.find(({ prefix }) => isPathFor(prefix)(path));

const serviceProxy = createProxyMiddleware({
  target: serviceTargets.auth,
  changeOrigin: false,
  xfwd: true,
  proxyTimeout: Number(process.env.PROXY_TIMEOUT_MS || 10000),
  timeout: Number(process.env.PROXY_SOCKET_TIMEOUT_MS || 15000),
  pathFilter: (path) => Boolean(findServiceRoute(path)),
  router: (req) => findServiceRoute(req.url)?.target || serviceTargets.auth,
  on: {
    error: (_error, _req, res) => {
      if (!res.headersSent) {
        res.status(502).json({ message: "Servicio temporalmente no disponible" });
      }
    }
  }
});

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  optionsSuccessStatus: 204
}));
app.use(morgan(process.env.NODE_ENV === "test" ? "tiny" : "combined"));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/health"
});
app.use(limiter);

// Nunca se confía en identidades enviadas por el cliente. La identidad válida
// la obtiene cada microservicio al verificar el JWT del encabezado Authorization.
app.use((req, _res, next) => {
  for (const header of ["x-auth-id", "x-user-id", "x-user-role", "x-user-email"]) {
    delete req.headers[header];
  }
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Las rutas se mantienen iguales al reenviarlas. Por ejemplo,
// /api/achievements/me llega al servicio con esa misma ruta.
app.use(serviceProxy);

app.use((_req, res) => res.status(404).json({ message: "Ruta no encontrada en el API Gateway" }));

module.exports = { app, serviceTargets, serviceRoutes, isPathFor, findServiceRoute };
