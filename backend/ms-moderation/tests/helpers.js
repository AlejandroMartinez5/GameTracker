const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const AUTH_ID = "64b7f0c2a1b2c3d4e5f60718";
const OTHER_AUTH_ID = "64b7f0c2a1b2c3d4e5f60799";

const setupTestKeys = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ms-moderation-test-"));
  const publicKeyPath = path.join(dir, "public.pem");
  fs.writeFileSync(publicKeyPath, publicKey);
  process.env.JWT_PUBLIC_KEY_PATH = publicKeyPath;

  const signToken = (payload = {}, options = {}) =>
    jwt.sign(
      { sub: AUTH_ID, role: "USER", emailVerified: true, ...payload },
      privateKey,
      { algorithm: "RS256", expiresIn: "1h", ...options }
    );

  return { signToken, publicKeyPath, dir };
};

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

const { Module, createRequire } = require("node:module");

function loadWithMocks(targetPath, mocks = {}) {
  const filename = path.resolve(targetPath);
  const nativeRequire = createRequire(filename);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : nativeRequire(request);
  loaded._compile(fs.readFileSync(filename, "utf8"), filename);
  return loaded.exports;
}
module.exports = { loadWithMocks };
module.exports = { AUTH_ID, OTHER_AUTH_ID, setupTestKeys, mockRes, loadWithMocks };
