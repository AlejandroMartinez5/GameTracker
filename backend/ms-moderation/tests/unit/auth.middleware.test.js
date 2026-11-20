const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { unlinkSync, rmdirSync } = require("node:fs");

const { AUTH_ID, OTHER_AUTH_ID, mockRes, setupTestKeys } = require("../helpers");
const { authenticateToken, requireAdmin } = require("../../src/middlewares/auth.middleware");

const run = async (t, middleware, req) => {
  const res = mockRes();
  const next = t.mock.fn();
  await middleware(req, res, next);
  return { res, next };
};

const mockCurrentUser = (t, user) =>
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ data: { user } })
  }));

describe("authenticateToken", () => {
  let keys;
  let originalKeyPath;

  before(() => {
    originalKeyPath = process.env.JWT_PUBLIC_KEY_PATH;
    keys = setupTestKeys();
  });

  after(() => {
    if (originalKeyPath === undefined) delete process.env.JWT_PUBLIC_KEY_PATH;
    else process.env.JWT_PUBLIC_KEY_PATH = originalKeyPath;
    unlinkSync(keys.publicKeyPath);
    rmdirSync(keys.dir);
  });

  it("usa sub como authId y conserva el rol actual de la cuenta", async (t) => {
    const user = { _id: AUTH_ID, role: "USER", accountStatus: "ACTIVE" };
    const fetchMock = mockCurrentUser(t, user);
    const token = keys.signToken({ role: "ADMIN" });
    const req = { headers: { authorization: "Bearer " + token } };

    const { next } = await run(t, authenticateToken, req);

    assert.equal(next.mock.callCount(), 1);
    assert.deepEqual(req.user, { ...user, authId: AUTH_ID });
    assert.equal(req.authToken, token);
    assert.equal(fetchMock.mock.calls[0].arguments[1].headers.Authorization, "Bearer " + token);
    assert.equal((await run(t, requireAdmin, req)).res.statusCode, 403);
  });

  for (const accountStatus of ["BANNED", "SUSPENDED"]) {
    it("rechaza una cuenta " + accountStatus + " con un token vigente", async (t) => {
      mockCurrentUser(t, { _id: AUTH_ID, role: "ADMIN", accountStatus });
      const req = { headers: { authorization: "Bearer " + keys.signToken() } };

      const { res, next } = await run(t, authenticateToken, req);

      assert.equal(next.mock.callCount(), 0);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { message: "Cuenta no disponible" });
    });
  }

  it("rechaza tokens sin un sub valido antes de consultar la cuenta", async (t) => {
    const fetchMock = mockCurrentUser(t, { _id: AUTH_ID });
    const token = keys.signToken({ sub: "legacy" });
    const req = { headers: { authorization: "Bearer " + token } };

    const { res, next } = await run(t, authenticateToken, req);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("rechaza una cuenta que no coincide con el sub del JWT", async (t) => {
    mockCurrentUser(t, { _id: OTHER_AUTH_ID, role: "ADMIN" });
    const req = { headers: { authorization: "Bearer " + keys.signToken() } };

    const { res, next } = await run(t, authenticateToken, req);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });
});

describe("requireAdmin", () => {
  it("permite continuar a un administrador", async (t) => {
    const { next } = await run(t, requireAdmin, { user: { role: "ADMIN" } });

    assert.equal(next.mock.callCount(), 1);
  });
});
