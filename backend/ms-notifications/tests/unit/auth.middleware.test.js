const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadWithMocks, mockRes } = require("../helpers.cjs");

function buildMiddleware(t, verify = () => ({})) {
  const verifyToken = t.mock.fn(verify);
  const middleware = loadWithMocks(path.join(__dirname, "../../src/middlewares/auth.middleware.js"), {
    "../utils/jwt.util": { verifyToken }
  });
  return { ...middleware, verifyToken };
}

describe("authenticateToken", () => {
  for (const [claims, authId] of [
    [{ sub: "user-1", authId: "legacy" }, "user-1"],
    [{ authId: "legacy" }, "legacy"]
  ]) {
    it("identifica al usuario como " + authId, (t) => {
      const { authenticateToken, verifyToken } = buildMiddleware(t, () => ({ ...claims, role: "USER" }));
      const req = { get: () => "Bearer signed-token" };
      const next = t.mock.fn();

      authenticateToken(req, mockRes(), next);

      assert.deepEqual(verifyToken.mock.calls[0].arguments, ["signed-token"]);
      assert.deepEqual(req.user, { authId, email: undefined, role: "USER" });
      assert.equal(next.mock.callCount(), 1);
    });
  }

  it("rechaza una cabecera incorrecta antes de verificar el token", (t) => {
    const { authenticateToken, verifyToken } = buildMiddleware(t);
    const res = mockRes();
    const next = t.mock.fn();

    authenticateToken({ get: () => "Basic signed-token" }, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(verifyToken.mock.callCount(), 0);
    assert.equal(next.mock.callCount(), 0);
  });

  it("rechaza un token sin identificador de usuario", (t) => {
    const { authenticateToken } = buildMiddleware(t);
    const res = mockRes();
    const next = t.mock.fn();

    authenticateToken({ get: () => "Bearer signed-token" }, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });

  it("devuelve 401 para un token expirado", (t) => {
    const { authenticateToken } = buildMiddleware(t, () => {
      throw Object.assign(new Error("Expired"), { name: "TokenExpiredError" });
    });
    const res = mockRes();
    const next = t.mock.fn();

    authenticateToken({ get: () => "Bearer signed-token" }, res, next);

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: "Token expirado" });
    assert.equal(next.mock.callCount(), 0);
  });
});

describe("requireAdmin", () => {
  for (const role of ["ADMIN", "USER"]) {
    it("aplica el permiso de administrador al rol " + role, (t) => {
      const { requireAdmin } = buildMiddleware(t);
      const res = mockRes();
      const next = t.mock.fn();

      requireAdmin({ user: { role } }, res, next);

      assert.equal(next.mock.callCount(), role === "ADMIN" ? 1 : 0);
      assert.equal(res.statusCode, role === "ADMIN" ? 200 : 403);
    });
  }
});
