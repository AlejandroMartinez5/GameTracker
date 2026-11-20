const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const { uploadImage } = require("../../src/middlewares/upload.middleware");

const app = express();
app.post("/upload", uploadImage, (req, res) => {
  res.json({ file: req.file ? { mimetype: req.file.mimetype, size: req.file.size } : null });
});

describe("upload.middleware.uploadImage", () => {
  it("acepta PNG", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.from("png"), { filename: "a.png", contentType: "image/png" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.file, { mimetype: "image/png", size: 3 });
  });

  it("acepta JPG", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.from("jpg"), { filename: "a.jpg", contentType: "image/jpeg" });

    assert.equal(res.status, 200);
  });

  it("continúa sin archivo", async () => {
    const res = await request(app).post("/upload").field("content", "hola");

    assert.equal(res.status, 200);
    assert.equal(res.body.file, null);
  });

  it("rechaza formatos no permitidos con 400", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.from("gif"), { filename: "a.gif", contentType: "image/gif" });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Formato de imagen no permitido. Usa JPG o PNG");
  });

  it("rechaza imágenes que superan 5 MB", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "big.png",
        contentType: "image/png"
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "La imagen supera el tamaño máximo permitido");
  });

  it("rechaza un campo de archivo distinto a 'image'", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("foto", Buffer.from("png"), { filename: "a.png", contentType: "image/png" });

    assert.equal(res.status, 400);
  });
});
