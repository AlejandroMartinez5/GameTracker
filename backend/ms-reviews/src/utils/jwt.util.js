const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

let publicKey;

const getPublicKey = () => {
  if (publicKey) {
    return publicKey;
  }

  const publicKeyPath =
    process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, "../keys/public.pem");

  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`No se encontró la llave pública en: ${publicKeyPath}`);
  }

  publicKey = fs.readFileSync(publicKeyPath, "utf8");

  return publicKey;
};

const verifyToken = (token) => {
  return jwt.verify(token, getPublicKey(), {
    algorithms: ["RS256"]
  });
};

module.exports = {
  verifyToken
};
