process.env.NODE_ENV = "test";

const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { setupTestKeys, makeReview, makeComment, AUTH_ID } = require("../helpers");

const { signToken } = setupTestKeys();
const reviewsService = require("../../src/services/reviews.service");
const commentsService = require("../../src/services/comments.service");
const leaderboardsService = require("../../src/services/leaderboards.service");
const { pool } = require("../../src/config/db");
const app = require("../../src/app");

const auth = (payload) => ({ Authorization: `Bearer ${signToken(payload)}` });
const httpError = (message, status) => Object.assign(new Error(message), { status });

describe("app", () => {
  afterEach(() => mock.restoreAll());

  describe("generales", () => {
    it("GET /health responde ok si la BD contesta", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));

      const res = await request(app).get("/health");

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: "ok" });
    });

    it("GET /health responde 503 si la BD falla", async () => {
      mock.method(pool, "query", async () => {
        throw new Error("down");
      });

      const res = await request(app).get("/health");

      assert.equal(res.status, 503);
    });

    it("ruta inexistente responde 404", async () => {
      const res = await request(app).get("/no-existe");

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Ruta no encontrada" });
    });

    it("JSON inválido responde 400", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(auth())
        .set("Content-Type", "application/json")
        .send("{malo");

      assert.equal(res.status, 400);
      assert.equal(res.body.message, "El cuerpo de la petición no es un JSON válido");
    });
  });

  describe("reviews", () => {
    it("POST /api/reviews crea la reseña y pasa el token al service", async () => {
      const review = makeReview();
      const create = mock.method(reviewsService, "createReview", async () => review);
      const headers = auth();

      const res = await request(app)
        .post("/api/reviews")
        .set(headers)
        .send({ igdbId: 1942, rating: 5, content: "Genial" });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Reseña creada correctamente");
      assert.equal(res.body.data.id, review.id);

      const [body, user, options] = create.mock.calls[0].arguments;
      assert.deepEqual(body, { igdbId: 1942, rating: 5, content: "Genial", image: null });
      assert.equal(user.authId, AUTH_ID);
      assert.equal(options.token, headers.Authorization.split(" ")[1]);
    });

    it("POST /api/reviews acepta multipart con imagen", async () => {
      const create = mock.method(reviewsService, "createReview", async () => makeReview());

      const res = await request(app)
        .post("/api/reviews")
        .set(auth())
        .field("igdbId", "1942")
        .field("rating", "5")
        .field("content", "Genial")
        .attach("image", Buffer.from("img"), { filename: "a.png", contentType: "image/png" });

      assert.equal(res.status, 201);
      const { image, igdbId } = create.mock.calls[0].arguments[0];
      assert.equal(igdbId, "1942");
      assert.equal(image.mimeType, "image/png");
      assert.equal(image.size, 3);
      assert.ok(Buffer.isBuffer(image.data));
    });

    it("POST /api/reviews sin token responde 401", async () => {
      const create = mock.method(reviewsService, "createReview", async () => {});

      const res = await request(app).post("/api/reviews").send({});

      assert.equal(res.status, 401);
      assert.equal(create.mock.callCount(), 0);
    });

    it("POST /api/reviews con correo no verificado responde 403", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(auth({ emailVerified: false }))
        .send({});

      assert.equal(res.status, 403);
    });

    it("propaga los errores del service con su status", async () => {
      mock.method(reviewsService, "createReview", async () => {
        throw httpError("Ya tienes una reseña para este videojuego", 409);
      });

      const res = await request(app).post("/api/reviews").set(auth()).send({});

      assert.equal(res.status, 409);
      assert.equal(res.body.message, "Ya tienes una reseña para este videojuego");
    });

    it("oculta errores inesperados con 500", async () => {
      mock.method(reviewsService, "getReviewById", async () => {
        throw new Error("detalle interno de la BD");
      });

      const res = await request(app).get("/api/reviews/1");

      assert.equal(res.status, 500);
      assert.equal(res.body.message, "Error interno del servidor");
    });

    it("GET /api/reviews/game/:igdbId funciona sin token", async () => {
      const get = mock.method(reviewsService, "getReviewsByGame", async () => ({ reviews: [] }));

      const res = await request(app).get("/api/reviews/game/1942?page=2");

      assert.equal(res.status, 200);
      const [igdbId, query, user] = get.mock.calls[0].arguments;
      assert.deepEqual([igdbId, { ...query }, user], ["1942", { page: "2" }, null]);
    });

    it("GET /api/reviews/user/:authId/summary llama al resumen", async () => {
      const summary = mock.method(reviewsService, "getUserReviewsSummary", async () => ({}));
      const byUser = mock.method(reviewsService, "getReviewsByUser", async () => ({}));

      await request(app).get(`/api/reviews/user/${AUTH_ID}/summary`).expect(200);

      assert.equal(summary.mock.calls[0].arguments[0], AUTH_ID);
      assert.equal(byUser.mock.callCount(), 0);
    });

    it("GET /api/reviews/user/:authId lista reseñas", async () => {
      mock.method(reviewsService, "getReviewsByUser", async () => ({ reviews: [] }));

      const res = await request(app).get(`/api/reviews/user/${AUTH_ID}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.message, "Reseñas del usuario obtenidas correctamente");
    });

    it("PUT /api/reviews/:id actualiza", async () => {
      const update = mock.method(reviewsService, "updateReview", async () => makeReview());

      const res = await request(app).put("/api/reviews/1").set(auth()).send({ rating: 3 });

      assert.equal(res.status, 200);
      assert.equal(update.mock.calls[0].arguments[0], "1");
    });

    it("DELETE /api/reviews/:id elimina", async () => {
      mock.method(reviewsService, "deleteReview", async () => ({
        message: "Reseña eliminada correctamente"
      }));

      const res = await request(app).delete("/api/reviews/1").set(auth());

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { message: "Reseña eliminada correctamente" });
    });

    it("POST /api/reviews/:id/image sin archivo responde 400", async () => {
      const add = mock.method(reviewsService, "addReviewImage", async () => {});

      const res = await request(app).post("/api/reviews/1/image").set(auth());

      assert.equal(res.status, 400);
      assert.equal(res.body.message, "Debes enviar una imagen");
      assert.equal(add.mock.callCount(), 0);
    });

    it("GET /api/reviews/:id/image devuelve el binario con sus headers", async () => {
      mock.method(reviewsService, "getReviewImage", async () => ({
        image_data: Buffer.from("PNGDATA"),
        image_mime_type: "image/png",
        image_size: 7
      }));

      const res = await request(app).get("/api/reviews/1/image");

      assert.equal(res.status, 200);
      assert.equal(res.headers["content-type"], "image/png");
      assert.equal(res.headers["cache-control"], "public, max-age=3600");
      assert.equal(res.body.toString(), "PNGDATA");
    });

    it("POST y DELETE /api/reviews/:id/like", async () => {
      mock.method(reviewsService, "likeReview", async () => ({ message: "Like agregado correctamente" }));
      mock.method(reviewsService, "unlikeReview", async () => ({ message: "Like eliminado correctamente" }));

      await request(app).post("/api/reviews/1/like").set(auth()).expect(200);
      await request(app).delete("/api/reviews/1/like").set(auth()).expect(200);
      await request(app).post("/api/reviews/1/like").expect(401);
    });

    it("GET /api/reviews/:id/likes", async () => {
      mock.method(reviewsService, "getReviewLikes", async () => ({ reviewId: 1, likesCount: 3 }));

      const res = await request(app).get("/api/reviews/1/likes");

      assert.deepEqual(res.body.data, { reviewId: 1, likesCount: 3 });
    });
  });

  describe("comments", () => {
    it("POST /api/reviews/:id/comments crea comentario", async () => {
      const create = mock.method(commentsService, "createComment", async () => makeComment());

      const res = await request(app)
        .post("/api/reviews/1/comments")
        .set(auth())
        .send({ content: "hola" });

      assert.equal(res.status, 201);
      assert.deepEqual(create.mock.calls[0].arguments[1], { content: "hola", image: null });
    });

    it("POST /api/reviews/:id/comments requiere correo verificado", async () => {
      const res = await request(app)
        .post("/api/reviews/1/comments")
        .set(auth({ emailVerified: false }))
        .send({ content: "hola" });

      assert.equal(res.status, 403);
    });

    it("GET /api/reviews/:id/comments pasa el usuario opcional", async () => {
      const get = mock.method(commentsService, "getCommentsByReview", async () => ({ comments: [] }));

      await request(app).get("/api/reviews/1/comments").set(auth()).expect(200);

      assert.equal(get.mock.calls[0].arguments[2].authId, AUTH_ID);
    });

    it("GET /api/comments/:id", async () => {
      mock.method(commentsService, "getCommentById", async () => makeComment());

      const res = await request(app).get("/api/comments/10");

      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, 10);
    });

    it("GET /api/comments/:id 404 del service", async () => {
      mock.method(commentsService, "getCommentById", async () => {
        throw httpError("Comentario no encontrado", 404);
      });

      const res = await request(app).get("/api/comments/10");

      assert.equal(res.status, 404);
      assert.equal(res.body.message, "Comentario no encontrado");
    });

    it("DELETE /api/comments/:id requiere token", async () => {
      mock.method(commentsService, "deleteComment", async () => ({ message: "ok" }));

      await request(app).delete("/api/comments/10").expect(401);
      await request(app).delete("/api/comments/10").set(auth()).expect(200);
    });

    it("likes de comentarios", async () => {
      mock.method(commentsService, "likeComment", async () => ({ message: "ok" }));
      mock.method(commentsService, "unlikeComment", async () => ({ message: "ok" }));
      mock.method(commentsService, "getCommentLikes", async () => ({ commentId: 10, likesCount: 1 }));

      await request(app).post("/api/comments/10/like").set(auth()).expect(200);
      await request(app).delete("/api/comments/10/like").set(auth()).expect(200);
      const res = await request(app).get("/api/comments/10/likes").expect(200);
      assert.equal(res.body.data.likesCount, 1);
    });

    it("POST /api/comments/:id/image sin archivo responde 400", async () => {
      await request(app).post("/api/comments/10/image").set(auth()).expect(400);
    });

    it("DELETE /api/comments/:id/image", async () => {
      mock.method(commentsService, "removeCommentImage", async () => ({ imageUrl: null }));

      const res = await request(app).delete("/api/comments/10/image").set(auth());

      assert.equal(res.status, 200);
      assert.equal(res.body.message, "Imagen del comentario eliminada correctamente");
    });
  });

  describe("leaderboards", () => {
    for (const [path, fn] of [
      ["users", "getTopUsers"],
      ["reviews", "getTopReviews"],
      ["comments", "getTopComments"]
    ]) {
      it(`GET /api/leaderboards/${path} requiere token y llama a ${fn}`, async () => {
        const svc = mock.method(leaderboardsService, fn, async () => ({ top: [] }));

        await request(app).get(`/api/leaderboards/${path}`).expect(401);
        await request(app).get(`/api/leaderboards/${path}?period=24h`).set(auth()).expect(200);

        assert.deepEqual({ ...svc.mock.calls[0].arguments[0] }, { period: "24h" });
        assert.equal(svc.mock.calls[0].arguments[1].authId, AUTH_ID);
      });
    }

    it("periodo inválido responde 400", async () => {
      mock.method(leaderboardsService, "getTopUsers", async () => {
        throw httpError("period debe ser uno de: 24h, week, month, all", 400);
      });

      const res = await request(app).get("/api/leaderboards/users?period=x").set(auth());

      assert.equal(res.status, 400);
    });

    it("error inesperado usa el mensaje propio del controller", async () => {
      mock.method(leaderboardsService, "getTopReviews", async () => {
        throw new Error("boom");
      });

      const res = await request(app).get("/api/leaderboards/reviews").set(auth());

      assert.equal(res.status, 500);
      assert.equal(res.body.message, "Error al obtener el ranking de reseñas");
    });
  });
});
