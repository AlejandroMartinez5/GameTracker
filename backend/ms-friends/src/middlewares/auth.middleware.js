const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const publicKey = fs.readFileSync(
  path.join(__dirname, "../keys/public.pem"),
  "utf8"
);

function verifyToken(token) {
  const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] });

  if (typeof payload !== "object" || payload === null ||
      typeof payload.sub !== "string" || !/^[a-f\d]{24}$/i.test(payload.sub) ||
      !Number.isFinite(payload.exp)) {
    throw new Error("Token sin identidad o expiración válidas");
  }

  return payload;
}

function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    req.user = verifyToken(match[1]);
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }

  return next();
}

module.exports = { authenticate, verifyToken };
