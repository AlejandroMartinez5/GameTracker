const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const privateKeyPath = path.join(__dirname, "../keys/private.pem");
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const publicKeyPath = path.join(__dirname, "../keys/public.pem");
const publicKey = fs.readFileSync(publicKeyPath, "utf8");

const signToken = (payload) => {
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "1h" });
};

const verifyToken = (token) => {
    return jwt.verify(token, publicKey, { algorithms: ["RS256"] });
  };

module.exports = {
    signToken,
    verifyToken         
};
