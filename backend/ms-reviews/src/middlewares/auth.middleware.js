const { verifyToken } = require("../utils/jwt.util");

const AUTH_ID_PATTERN = /^[a-f\d]{24}$/i;

const getBearerToken = (req) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") || "");

  return match ? match[1] : null;
};

const buildUserFromToken = (decoded) => {
  if (!decoded || typeof decoded !== "object" || !AUTH_ID_PATTERN.test(decoded.sub || "")) {
    throw new Error("Invalid subject");
  }

  return {
    authId: decoded.sub,
    role: decoded.role,
    emailVerified: decoded.emailVerified === true
  };
};

const authenticateToken = (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    req.user = buildUserFromToken(verifyToken(token));

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

const optionalAuthenticateToken = (req, res, next) => {
  if (!req.get("authorization")) {
    req.user = null;

    return next();
  }

  return authenticateToken(req, res, next);
};

const requireVerifiedEmail = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      message: "Debes verificar tu correo para publicar reseñas o comentarios"
    });
  }

  return next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Se requiere rol de administrador" });
  }

  return next();
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  requireVerifiedEmail,
  requireAdmin
};
