const { verifyToken } = require("../utils/jwt.util");

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token no proporcionado o formato invalido"
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded.authId) {
      return res.status(401).json({
        message: "El token no contiene authId"
      });
    }

    req.user = {
      authId: decoded.authId,
      email: decoded.email,
      role: decoded.role
    };

    return next();
  } catch (error) {
    console.warn("[ms-user-library] Error validando token:", error.name, error.message);

    return res.status(401).json({
      message: error.name === "TokenExpiredError" ? "Token expirado" : "Token invalido"
    });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Se requiere rol de administrador" });
    }

    return next();
  }
};
