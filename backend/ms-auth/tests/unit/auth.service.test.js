const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { AUTH_ID, loadWithMocks } = require("../helpers.cjs");

const password = "Clave1234";
const registration = {
  email: " ANA@EXAMPLE.TEST ",
  username: " Ana ",
  name: " Ana Pérez ",
  password
};
const user = {
  _id: AUTH_ID,
  email: "ana@example.test",
  username: "ana",
  name: "Ana Pérez",
  password: "stored-hash",
  role: "USER",
  accountStatus: "ACTIVE",
  emailVerified: false
};

function buildService(t, overrides = {}) {
  const repo = {
    createUser: t.mock.fn(async () => user),
    findCredentialsByEmail: t.mock.fn(async () => user),
    findByEmail: t.mock.fn(async () => user),
    setPasswordResetToken: t.mock.fn(async () => {}),
    consumePasswordResetToken: t.mock.fn(async () => user),
    ...overrides.repo
  };
  const signToken = t.mock.fn(() => "signed-token");
  const events = {
    publishUserCreated: t.mock.fn(),
    publishPasswordReset: t.mock.fn()
  };
  const sendPasswordResetCode = t.mock.fn(async () => {});
  const hash = t.mock.fn(async () => "new-hash");
  const service = loadWithMocks("services/auth.service.js", {
    bcrypt: { hash, compare: async (value) => value === password },
    mongoose: {},
    "../repositories/user.repository": repo,
    "../middlewares/auth.middleware": { signToken },
    "./email-verification.service": {
      sendCode: overrides.sendCode || (async () => ({ emailVerified: false }))
    },
    "./mail.service": { sendPasswordResetCode },
    "../clients/profile.client": {},
    "../clients/stats.client": {},
    "../utils/user-events.util": events
  });
  return { service, repo, signToken, events, sendPasswordResetCode, hash };
}

describe("registerUser", () => {
  it("normaliza los datos y guarda el hash de la contraseña", async (t) => {
    const { service, repo, events, hash } = buildService(t);
    const result = await service.registerUser(registration);

    assert.deepEqual(hash.mock.calls[0].arguments, [password, 10]);
    assert.deepEqual(repo.createUser.mock.calls[0].arguments[0], {
      email: user.email,
      username: user.username,
      name: user.name,
      passwordHash: "new-hash",
      profileImageData: undefined,
      profileImageMimeType: undefined
    });
    assert.equal(Object.hasOwn(result.user, "password"), false);
    assert.deepEqual(events.publishUserCreated.mock.calls[0].arguments, [user]);
  });

  it("rechaza datos inválidos antes de crear la cuenta", async (t) => {
    const { service, repo, hash } = buildService(t);
    await assert.rejects(service.registerUser({ ...registration, email: "ana" }), {
      statusCode: 400
    });
    assert.equal(hash.mock.callCount(), 0);
    assert.equal(repo.createUser.mock.callCount(), 0);
  });

  it("conserva la cuenta cuando falla el correo de verificación", async (t) => {
    const { service, events } = buildService(t, {
      sendCode: async () => { throw new Error("Correo no disponible"); }
    });
    const result = await service.registerUser(registration);

    assert.equal(result.user._id, AUTH_ID);
    assert.equal(result.verification.emailVerified, false);
    assert.equal(events.publishUserCreated.mock.callCount(), 1);
  });

  it("traduce una cuenta duplicada a 409", async (t) => {
    const { service, events } = buildService(t, {
      repo: {
        createUser: async () => { throw Object.assign(new Error("Duplicado"), { code: 11000 }); }
      }
    });
    await assert.rejects(service.registerUser(registration), { statusCode: 409 });
    assert.equal(events.publishUserCreated.mock.callCount(), 0);
  });
});

describe("login", () => {
  it("emite un token con los datos de la cuenta", async (t) => {
    const { service, repo, signToken } = buildService(t);
    const result = await service.login({ email: registration.email, password });

    assert.deepEqual(repo.findCredentialsByEmail.mock.calls[0].arguments, [user.email]);
    assert.deepEqual(signToken.mock.calls[0].arguments, [{
      sub: AUTH_ID,
      authId: AUTH_ID,
      role: "USER",
      emailVerified: false
    }]);
    assert.equal(result.token, "signed-token");
    assert.equal(Object.hasOwn(result.user, "password"), false);
  });

  it("rechaza una contraseña incorrecta sin emitir un token", async (t) => {
    const { service, signToken } = buildService(t);
    await assert.rejects(service.login({ email: user.email, password: "incorrecta" }), {
      statusCode: 401
    });
    assert.equal(signToken.mock.callCount(), 0);
  });

  for (const accountStatus of ["BANNED", "SUSPENDED"]) {
    it("rechaza una cuenta " + accountStatus, async (t) => {
      const { service, signToken } = buildService(t, {
        repo: {
          findCredentialsByEmail: async () => ({
            ...user, accountStatus, suspendedUntil: new Date(Date.now() + 60_000)
          })
        }
      });
      await assert.rejects(service.login({ email: user.email, password }), { statusCode: 403 });
      assert.equal(signToken.mock.callCount(), 0);
    });
  }

  it("permite iniciar sesión cuando la suspensión terminó", async (t) => {
    const { service } = buildService(t, {
      repo: {
        findCredentialsByEmail: async () => ({
          ...user, accountStatus: "SUSPENDED", suspendedUntil: new Date(0)
        })
      }
    });
    const result = await service.login({ email: user.email, password });

    assert.equal(result.user.accountStatus, "ACTIVE");
    assert.equal(result.token, "signed-token");
  });
});

describe("recuperación de contraseña", () => {
  it("envía un código y guarda su hash con vencimiento", async (t) => {
    const { service, repo, sendPasswordResetCode } = buildService(t);
    const startedAt = Date.now();
    const result = await service.forgotPassword(user.email);
    const [email, code] = sendPasswordResetCode.mock.calls[0].arguments;
    const [id, hash, expires] = repo.setPasswordResetToken.mock.calls[0].arguments;
    const unknown = buildService(t, { repo: { findByEmail: async () => null } });

    assert.equal(email, user.email);
    assert.match(code, /^\d{6}$/);
    assert.equal(id, AUTH_ID);
    assert.equal(hash, createHash("sha256").update(code).digest("hex"));
    assert.ok(expires.getTime() >= startedAt + 900_000);
    assert.deepEqual(await unknown.service.forgotPassword("otro@example.test"), result);
    assert.equal(unknown.sendPasswordResetCode.mock.callCount(), 0);
  });

  it("consume el código y publica el evento al guardar la nueva contraseña", async (t) => {
    const { service, repo, events } = buildService(t);
    const code = "012345";
    await service.resetPassword({ code, password });

    assert.deepEqual(repo.consumePasswordResetToken.mock.calls[0].arguments, [
      createHash("sha256").update(code).digest("hex"), "new-hash"
    ]);
    assert.deepEqual(events.publishPasswordReset.mock.calls[0].arguments, [AUTH_ID]);
  });

  it("rechaza un código expirado sin publicar el evento", async (t) => {
    const { service, events } = buildService(t, {
      repo: { consumePasswordResetToken: async () => null }
    });
    await assert.rejects(service.resetPassword({ code: "012345", password }), { statusCode: 400 });
    assert.equal(events.publishPasswordReset.mock.callCount(), 0);
  });
});
