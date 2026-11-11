const { verifyToken } = require("../utils/jwt.util");
const authRepository = require("../repositories/auth.repository");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded.authId) {
      return res.status(401).json({ error: "Token invalido" });
    }

    const user = await authRepository.findById(decoded.authId);

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    if (user.accountStatus === "BANNED") {
      return res.status(403).json({ error: "Cuenta baneada" });
    }

    if (user.accountStatus === "SUSPENDED") {
      return res.status(403).json({ error: "Cuenta suspendida temporalmente" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Se requiere rol de administrador" });
  }

  next();
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
