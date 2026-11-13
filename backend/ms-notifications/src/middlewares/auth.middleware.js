const { verifyToken } = require("../utils/jwt.util");

const authenticateToken = (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") || "");
  if (!match) return res.status(401).json({ message: "Token requerido" });

  try {
    const decoded = verifyToken(match[1]);
    const authId = decoded.sub || decoded.authId;
    if (!authId) return res.status(401).json({ message: "El token no contiene authId" });
    req.user = { authId, email: decoded.email, role: decoded.role };
    return next();
  } catch (error) {
    return res.status(401).json({ message: error.name === "TokenExpiredError" ? "Token expirado" : "Token inválido" });
  }
};

module.exports = { authenticateToken };

