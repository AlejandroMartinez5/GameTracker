const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const { setupTestKeys, mockRes, AUTH_ID } = require("../helpers");

const { signToken } = setupTestKeys();
const {
  authenticateToken,
  optionalAuthenticateToken,
  requireVerifiedEmail,
  requireAdmin
} = require("../../src/middlewares/auth.middleware");

const mockReq = (authorization) => ({
  get: (name) => (name.toLowerCase() === "authorization" ? authorization : undefined)
});

const run = (middleware, req) => {
  const res = mockRes();
  const next = mock.fn();
  middleware(req, res, next);
  return { res, next };
};

describe("authenticateToken", () => {
  it("acepta un token válido y llena req.user", () => {
    const req = mockReq(`Bearer ${signToken({ role: "ADMIN" })}`);
    const { next } = run(authenticateToken, req);

    assert.equal(next.mock.callCount(), 1);
    assert.deepEqual(req.user, { authId: AUTH_ID, role: "ADMIN", emailVerified: true });
  });

  it("emailVerified es false si no viene como true", () => {
    const req = mockReq(`Bearer ${signToken({ emailVerified: "true" })}`);
    run(authenticateToken, req);

    assert.equal(req.user.emailVerified, false);
  });

  it("acepta 'bearer' en minúsculas", () => {
    const { next } = run(authenticateToken, mockReq(`bearer ${signToken()}`));
    assert.equal(next.mock.callCount(), 1);
  });

  for (const header of [undefined, "", "Basic abc", "Bearer", "Bearer a b"]) {
    it(`responde 401 'Token requerido' con header ${JSON.stringify(header)}`, () => {
      const { res, next } = run(authenticateToken, mockReq(header));

      assert.equal(next.mock.callCount(), 0);
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { message: "Token requerido" });
    });
  }

  const invalidTokens = {
    "token mal formado": () => "no-es-un-jwt",
    "token expirado": () => signToken({}, { expiresIn: -10 }),
    "sub que no es ObjectId": () => signToken({ sub: "123" }),
    "firmado con otra llave": () => {
      const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
      return jwt.sign({ sub: AUTH_ID }, privateKey, { algorithm: "RS256" });
    },
    "algoritmo HS256": () => jwt.sign({ sub: AUTH_ID }, "secreto", { algorithm: "HS256" })
  };

  for (const [name, build] of Object.entries(invalidTokens)) {
    it(`responde 401 con ${name}`, () => {
      const { res, next } = run(authenticateToken, mockReq(`Bearer ${build()}`));

      assert.equal(next.mock.callCount(), 0);
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { message: "Token inválido o expirado" });
    });
  }
});

describe("optionalAuthenticateToken", () => {
  it("sin header deja req.user=null y continúa", () => {
    const req = mockReq(undefined);
    const { next } = run(optionalAuthenticateToken, req);

    assert.equal(req.user, null);
    assert.equal(next.mock.callCount(), 1);
  });

  it("con token válido autentica", () => {
    const req = mockReq(`Bearer ${signToken()}`);
    run(optionalAuthenticateToken, req);

    assert.equal(req.user.authId, AUTH_ID);
  });

  it("con token inválido responde 401", () => {
    const { res } = run(optionalAuthenticateToken, mockReq("Bearer basura"));
    assert.equal(res.statusCode, 401);
  });
});

describe("requireVerifiedEmail / requireAdmin", () => {
  it("requireVerifiedEmail deja pasar correos verificados", () => {
    const { next } = run(requireVerifiedEmail, { user: { emailVerified: true } });
    assert.equal(next.mock.callCount(), 1);
  });

  it("requireVerifiedEmail responde 403 si no está verificado", () => {
    const { res, next } = run(requireVerifiedEmail, { user: { emailVerified: false } });

    assert.equal(next.mock.callCount(), 0);
    assert.equal(res.statusCode, 403);
  });

  it("requireAdmin deja pasar ADMIN y bloquea al resto", () => {
    assert.equal(run(requireAdmin, { user: { role: "ADMIN" } }).next.mock.callCount(), 1);

    const { res } = run(requireAdmin, { user: { role: "USER" } });
    assert.equal(res.statusCode, 403);
    assert.equal(run(requireAdmin, {}).res.statusCode, 403);
  });
});
