const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const request = require("supertest");

const { app, isPathFor, findServiceRoute } = require("../src/app");

test("expone un healthcheck propio", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("no reescribe las rutas internas de los microservicios", () => {
  const achievementsPath = isPathFor("/api/achievements");

  assert.equal(achievementsPath("/api/achievements/me"), true);
  assert.equal(achievementsPath("/api/achievements?user=1"), true);
  assert.equal(achievementsPath("/api/reviews"), false);
});

test("selecciona el microservicio correcto para cada prefijo", () => {
  assert.equal(findServiceRoute("/api/achievements/me").prefix, "/api/achievements");
  assert.equal(findServiceRoute("/api/comments/1").prefix, "/api/comments");
  assert.equal(findServiceRoute("/api/unknown"), undefined);
});

test("reenvía la ruta, el Authorization y el cuerpo al microservicio", async () => {
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        url: req.url,
        authorization: req.headers.authorization,
        body: Buffer.concat(chunks).toString()
      }));
    });
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  const authRoute = findServiceRoute("/api/auth/echo");
  const originalTarget = authRoute.target;
  authRoute.target = `http://127.0.0.1:${address.port}`;

  try {
    const response = await request(app)
      .post("/api/auth/echo?check=1")
      .set("Authorization", "Bearer test-token")
      .send({ hello: "gateway" });

    assert.equal(response.status, 200);
    assert.equal(response.body.url, "/api/auth/echo?check=1");
    assert.equal(response.body.authorization, "Bearer test-token");
    assert.deepEqual(JSON.parse(response.body.body), { hello: "gateway" });
  } finally {
    authRoute.target = originalTarget;
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test("rechaza rutas que no pertenecen al gateway", async () => {
  const response = await request(app).get("/api/unknown");

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Ruta no encontrada en el API Gateway");
});
