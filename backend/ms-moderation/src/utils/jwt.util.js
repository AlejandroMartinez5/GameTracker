const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

let publicKey = null;

const getPublicKey = () => {
  if (publicKey) {
    return publicKey;
  }

  const publicKeyPath =
    process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, "../../../ms-auth/src/keys/public.pem");
  const resolvedPath = path.resolve(publicKeyPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`No se encontro la llave publica en: ${resolvedPath}`);
  }

  publicKey = fs.readFileSync(resolvedPath, "utf8");
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
