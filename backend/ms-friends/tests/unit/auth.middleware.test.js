const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks, mockRes } = require("../helpers.cjs");

function buildMiddleware(t, verify = () => ({})) {
  const verifyToken = t.mock.fn(verify);
  const middleware = loadWithMocks("middlewares/auth.middleware.js", {
    "../utils/jwt.util": { verifyToken }
  });
  return { ...middleware, verifyToken };
}

describe("authenticateToken", () => {
  it("verifica el token y adjunta los datos del usuario", (t) => {
    const user = { authId: "user-1", email: "ana@example.test", role: "USER" };
    const { authenticateToken, verifyToken } = buildMiddleware(t, () => ({ ...user, iat: 1 }));
    const req = { headers: { authorization: "Bearer signed-token" } };
    const next = t.mock.fn();

    authenticateToken(req, mockRes(), next);

    assert.deepEqual(verifyToken.mock.calls[0].arguments, ["signed-token"]);
    assert.deepEqual(req.user, user);
    assert.equal(next.mock.callCount(), 1);
  });

  for (const header of [undefined, "Basic signed-token"]) {
    it("rechaza la cabecera " + String(header), (t) => {
      const { authenticateToken, verifyToken } = buildMiddleware(t);
      const res = mockRes();
      const next = t.mock.fn();

      authenticateToken({ headers: { authorization: header } }, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(verifyToken.mock.callCount(), 0);
      assert.equal(next.mock.callCount(), 0);
    });
  }

  it("rechaza un token sin authId", (t) => {
    const { authenticateToken } = buildMiddleware(t, () => ({ role: "ADMIN" }));
    const req = { headers: { authorization: "Bearer signed-token" } };
    const res = mockRes();
    const next = t.mock.fn();

    authenticateToken(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(req.user, undefined);
    assert.equal(next.mock.callCount(), 0);
  });

  for (const [name, message] of [
    ["TokenExpiredError", "Token expirado"],
    ["JsonWebTokenError", "Token invalido"]
  ]) {
    it("devuelve 401 para " + name, (t) => {
      t.mock.method(console, "warn", () => {});
      const { authenticateToken } = buildMiddleware(t, () => {
        throw Object.assign(new Error("Fallo de verificación"), { name });
      });
      const res = mockRes();
      const next = t.mock.fn();

      authenticateToken({ headers: { authorization: "Bearer signed-token" } }, res, next);

      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { message });
      assert.equal(next.mock.callCount(), 0);
    });
  }
});

describe("requireAdmin", () => {
  it("permite continuar a un administrador", (t) => {
    const { requireAdmin } = buildMiddleware(t);
    const next = t.mock.fn();

    requireAdmin({ user: { role: "ADMIN" } }, mockRes(), next);

    assert.equal(next.mock.callCount(), 1);
  });

  it("rechaza una solicitud sin rol de administrador", (t) => {
    const { requireAdmin } = buildMiddleware(t);
    const res = mockRes();
    const next = t.mock.fn();

    requireAdmin({ user: { role: "USER" } }, res, next);

    assert.equal(res.statusCode, 403);
    assert.equal(next.mock.callCount(), 0);
  });
});
