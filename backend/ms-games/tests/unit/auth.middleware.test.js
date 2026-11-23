const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks, mockRes } = require("../helpers.cjs");

const user = { sub: "64b7f0c2a1b2c3d4e5f60718", role: "ADMIN" };

function buildMiddleware(t, verifyToken = () => user) {
  const verify = t.mock.fn(verifyToken);
  const middleware = loadWithMocks("middlewares/auth.middleware.js", {
    "node:fs": { readFileSync: () => "test-public-key" },
    jsonwebtoken: { verify },
    mongoose: { isObjectIdOrHexString: (id) => /^[a-f0-9]{24}$/i.test(id) }
  });
  return { ...middleware, verify };
}

describe("authenticate", () => {
  it("verifica el token RS256 y adjunta el usuario", (t) => {
    const { authenticate, verify } = buildMiddleware(t);
    const req = { get: () => "Bearer signed-token" };
    const next = t.mock.fn();

    authenticate(req, mockRes(), next);

    assert.deepEqual(verify.mock.calls[0].arguments, [
      "signed-token", "test-public-key", { algorithms: ["RS256"] }
    ]);
    assert.equal(req.user, user);
    assert.equal(next.mock.callCount(), 1);
  });

  it("rechaza cabeceras que no tienen formato Bearer", (t) => {
    const { authenticate, verify } = buildMiddleware(t);
    const res = mockRes();
    const next = t.mock.fn();

    authenticate({ get: () => "Basic signed-token" }, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(verify.mock.callCount(), 0);
  });

  it("rechaza un token cuyo subject no identifica una cuenta", (t) => {
    const { authenticate } = buildMiddleware(t, () => ({ ...user, sub: "invalid-id" }));
    const res = mockRes();
    const next = t.mock.fn();

    authenticate({ get: () => "Bearer signed-token" }, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });
});

describe("requireAdmin", () => {
  it("permite el acceso de un administrador", (t) => {
    const { requireAdmin } = buildMiddleware(t);
    const next = t.mock.fn();

    requireAdmin({ user }, mockRes(), next);

    assert.equal(next.mock.callCount(), 1);
  });

  it("devuelve 403 para un usuario sin rol de administrador", (t) => {
    const { requireAdmin } = buildMiddleware(t);
    const res = mockRes();
    const next = t.mock.fn();

    requireAdmin({ user: { ...user, role: "USER" } }, res, next);

    assert.equal(res.statusCode, 403);
    assert.equal(next.mock.callCount(), 0);
  });
});
