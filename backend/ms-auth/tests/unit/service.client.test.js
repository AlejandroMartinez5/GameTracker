const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { requestService } = require("../../src/clients/service.client");

const request = { baseUrl: "http://service.test/api/", path: "/stats", token: "admin" };

describe("service.client.requestService", () => {
  it("reenvía el token y devuelve data por defecto", async (t) => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ data: { count: 2 } })
    }));

    assert.deepEqual(await requestService(request), { count: 2 });
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, "http://service.test/api/stats");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, "Bearer admin");
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("conserva la respuesta completa cuando se solicita", async (t) => {
    const body = { data: ["item"], pagination: { page: 1 } };
    t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => body }));

    assert.deepEqual(await requestService({ ...request, unwrapData: false }), body);
  });

  it("propaga el mensaje del servicio externo", async (t) => {
    t.mock.method(globalThis, "fetch", async () => ({
      ok: false,
      json: async () => ({ message: "No encontrado" })
    }));

    await assert.rejects(requestService(request), { message: "No encontrado" });
  });

  it("traduce un fallo de red", async (t) => {
    t.mock.method(globalThis, "fetch", async () => { throw new Error("ECONNREFUSED"); });

    await assert.rejects(requestService(request), { message: "Servicio externo no disponible" });
  });
});
