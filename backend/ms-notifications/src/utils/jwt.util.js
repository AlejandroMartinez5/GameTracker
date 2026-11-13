const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

let publicKey;

const getPublicKey = () => {
  if (publicKey) return publicKey;

  const configuredPath = process.env.JWT_PUBLIC_KEY_PATH || "./src/keys/public.pem";
  const keyPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);

  if (!fs.existsSync(keyPath)) {
    throw new Error(`No se encontró la llave pública en: ${keyPath}`);
  }

  publicKey = fs.readFileSync(keyPath, "utf8");
  return publicKey;
};

const verifyToken = (token) => jwt.verify(token, getPublicKey(), { algorithms: ["RS256"] });

module.exports = { verifyToken };

