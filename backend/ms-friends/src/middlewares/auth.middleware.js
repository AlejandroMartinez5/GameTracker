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

    next();
  } catch (error) {
    console.warn("[ms-friends] Error validando token:", error.name, error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expirado"
      });
    }

    return res.status(401).json({
      message: "Token invalido"
    });
  }
};

module.exports = {
  authenticateToken
};
