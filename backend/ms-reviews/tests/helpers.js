const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const AUTH_ID = "64b7f0c2a1b2c3d4e5f60718";
const OTHER_AUTH_ID = "64b7f0c2a1b2c3d4e5f60799";

// Genera un par de llaves RSA temporal y apunta JWT_PUBLIC_KEY_PATH a la
// pública. Debe llamarse antes de que jwt.util lea (y cachee) la llave.
const setupTestKeys = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ms-reviews-test-"));
  const publicKeyPath = path.join(dir, "public.pem");
  fs.writeFileSync(publicKeyPath, publicKey);
  process.env.JWT_PUBLIC_KEY_PATH = publicKeyPath;

  const signToken = (payload = {}, options = {}) =>
    jwt.sign(
      { sub: AUTH_ID, role: "USER", emailVerified: true, ...payload },
      privateKey,
      { algorithm: "RS256", expiresIn: "1h", ...options }
    );

  return { signToken, privateKey };
};

const makeUser = (overrides = {}) => ({
  authId: AUTH_ID,
  role: "USER",
  emailVerified: true,
  ...overrides
});

const makeReview = (overrides = {}) => ({
  id: 1,
  auth_id: AUTH_ID,
  igdb_id: 1942,
  rating: 5,
  title: "Gran juego",
  content: "Me encantó",
  created_at: new Date().toISOString(),
  ...overrides
});

const makeComment = (overrides = {}) => ({
  id: 10,
  review_id: 1,
  auth_id: AUTH_ID,
  content: "Totalmente de acuerdo",
  ...overrides
});

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    }
  };

  return res;
};

module.exports = {
  AUTH_ID,
  OTHER_AUTH_ID,
  setupTestKeys,
  makeUser,
  makeReview,
  makeComment,
  mockRes
};
