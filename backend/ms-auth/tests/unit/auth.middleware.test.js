const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { AUTH_ID, loadWithMocks, mockRes } = require("../helpers.cjs");

function buildMiddleware(t) {
  const jwt = {
    sign: t.mock.fn(() => "signed-token"),
    verify: t.mock.fn((token) => {
      if (token === "invalid-token") throw new Error("Invalid signature");
      return { sub: token === "invalid-subject" ? "legacy" : AUTH_ID, role: "USER" };
    })
  };
  const middleware = loadWithMocks("middlewares/auth.middleware.js", {
    "node:fs": { readFileSync: (filename) => filename.endsWith("private.pem") ? "private" : "public" },
    jsonwebtoken: jwt,
    mongoose: { isObjectIdOrHexString: (id) => /^[a-f0-9]{24}$/i.test(id) }
  });
  return { middleware, jwt };
}

describe("auth.middleware", () => {
  it("firma con RS256 y una hora de vigencia", (t) => {
    const { middleware, jwt } = buildMiddleware(t);
    const payload = { sub: AUTH_ID };

    assert.equal(middleware.signToken(payload), "signed-token");
    assert.deepEqual(jwt.sign.mock.calls[0].arguments, [
      payload, "private", { algorithm: "RS256", expiresIn: "1h" }
    ]);
  });

  it("verifica el token y adjunta su contenido a la solicitud", (t) => {
    const { middleware, jwt } = buildMiddleware(t);
    const req = { get: () => "Bearer signed-token" };
    const next = t.mock.fn();

    middleware.authenticate(req, mockRes(), next);

    assert.deepEqual(jwt.verify.mock.calls[0].arguments, [
      "signed-token", "public", { algorithms: ["RS256"] }
    ]);
    assert.deepEqual(req.user, { sub: AUTH_ID, role: "USER" });
    assert.equal(next.mock.callCount(), 1);
  });

  for (const header of [undefined, "Basic signed-token", "Bearer signed token"]) {
    it("rechaza la cabecera " + String(header), (t) => {
      const { middleware, jwt } = buildMiddleware(t);
      const res = mockRes();
      const next = t.mock.fn();

      middleware.authenticate({ get: () => header }, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(jwt.verify.mock.callCount(), 0);
      assert.equal(next.mock.callCount(), 0);
    });
  }

  for (const token of ["invalid-token", "invalid-subject"]) {
    it("rechaza " + token, (t) => {
      const { middleware } = buildMiddleware(t);
      const req = { get: () => "Bearer " + token };
      const res = mockRes();
      const next = t.mock.fn();

      middleware.authenticate(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(req.user, undefined);
      assert.equal(next.mock.callCount(), 0);
    });
  }
});
