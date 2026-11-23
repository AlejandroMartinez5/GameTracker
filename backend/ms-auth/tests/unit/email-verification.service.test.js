const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { AUTH_ID, loadWithMocks } = require("../helpers.cjs");

const user = { _id: AUTH_ID, email: "ana@example.test", emailVerified: false };

function buildService(t, overrides = {}) {
  const repo = {
    issueCode: t.mock.fn(async () => user),
    invalidateCode: t.mock.fn(async () => {}),
    reserveAttempt: t.mock.fn(async () => ({ emailVerificationToken: "code-hash" })),
    consumeCode: t.mock.fn(async () => ({ ...user, emailVerified: true })),
    ...overrides.repo
  };
  const sendVerificationCode = t.mock.fn(overrides.send || (async () => {}));
  const service = loadWithMocks("services/email-verification.service.js", {
    "node:crypto": { randomInt: () => 42 },
    bcrypt: {
      hash: async () => "code-hash",
      compare: async (code, hash) => code === "000042" && hash === "code-hash"
    },
    "../repositories/email-verification.repository": repo,
    "./mail.service": { sendVerificationCode }
  });
  return { service, repo, sendVerificationCode };
}

describe("sendCode", () => {
  it("guarda el hash por diez minutos y envía el código de seis dígitos", async (t) => {
    const { service, repo, sendVerificationCode } = buildService(t);
    const result = await service.sendCode(user);
    const [id, hash, now, expiresAt] = repo.issueCode.mock.calls[0].arguments;

    assert.equal(id, AUTH_ID);
    assert.equal(hash, "code-hash");
    assert.equal(expiresAt - now, 600_000);
    assert.equal(result.expiresIn, 600);
    assert.deepEqual(sendVerificationCode.mock.calls[0].arguments, [user.email, "000042"]);
  });

  it("respeta el límite de reenvío", async (t) => {
    const { service, sendVerificationCode } = buildService(t, {
      repo: { issueCode: async () => null }
    });
    await assert.rejects(service.sendCode(user), { statusCode: 429 });
    assert.equal(sendVerificationCode.mock.callCount(), 0);
  });

  it("invalida el código si falla el correo", async (t) => {
    const { service, repo } = buildService(t, {
      send: async () => { throw new Error("Correo no disponible"); }
    });
    await assert.rejects(service.sendCode(user), { statusCode: 503 });
    assert.deepEqual(repo.invalidateCode.mock.calls[0].arguments, [AUTH_ID, "code-hash"]);
  });
});

describe("verifyCode", () => {
  it("consume el código correcto y confirma el correo", async (t) => {
    const { service, repo } = buildService(t);
    const result = await service.verifyCode(user, { code: "000042" });

    assert.equal(result.emailVerified, true);
    assert.equal(repo.reserveAttempt.mock.callCount(), 1);
    assert.deepEqual(repo.consumeCode.mock.calls[0].arguments.slice(0, 2), [AUTH_ID, "code-hash"]);
  });

  it("rechaza un código mal formado sin reservar un intento", async (t) => {
    const { service, repo } = buildService(t);
    await assert.rejects(service.verifyCode(user, { code: 42 }), { statusCode: 400 });
    assert.equal(repo.reserveAttempt.mock.callCount(), 0);
  });

  it("reserva un intento para un código incorrecto sin consumirlo", async (t) => {
    const { service, repo } = buildService(t);
    await assert.rejects(service.verifyCode(user, { code: "123456" }), { statusCode: 400 });
    assert.equal(repo.reserveAttempt.mock.callCount(), 1);
    assert.equal(repo.consumeCode.mock.callCount(), 0);
  });

  it("rechaza un código que dejó de ser válido antes de consumirlo", async (t) => {
    const { service } = buildService(t, { repo: { consumeCode: async () => null } });
    await assert.rejects(service.verifyCode(user, { code: "000042" }), { statusCode: 400 });
  });
});
