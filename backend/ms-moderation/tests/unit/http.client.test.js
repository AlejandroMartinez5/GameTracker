const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { requestService } = require("../../src/clients/http.client");

describe("http.client.requestService", () => {
  it("reenvia el token, serializa el cuerpo y devuelve data", async (t) => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ data: { ok: true } })
    }));

    const result = await requestService({
      baseUrl: "http://service.test/api/",
      path: "/target",
      method: "PATCH",
      token: "admin",
      body: { reason: "spam" }
    });

    assert.deepEqual(result, { ok: true });
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, "http://service.test/api/target");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, "Bearer admin");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), { reason: "spam" });
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("traduce un fallo de red a 502", async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    await assert.rejects(requestService({ baseUrl: "http://service.test", path: "/" }), {
      status: 502,
      message: "Servicio externo no disponible"
    });
  });

  it("conserva el 404 cuando el contenido no existe", async (t) => {
    t.mock.method(globalThis, "fetch", async () => ({
      ok: false,
      status: 404,
      json: async () => ({ message: "No encontrado" })
    }));

    await assert.rejects(requestService({ baseUrl: "http://service.test", path: "/" }), {
      status: 404,
      message: "No encontrado"
    });
  });
});
