const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const reviewsRepository = require("../../src/repositories/reviews.repository");
const gamesClient = require("../../src/clients/games.client");
const events = require("../../src/utils/events.util");
const service = require("../../src/services/reviews.service");
const { makeUser, makeReview, OTHER_AUTH_ID } = require("../helpers");

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

const validData = { igdbId: "1942", rating: "4", title: "  Título  ", content: "  Contenido  " };

describe("reviews.service", () => {
  beforeEach(() => {
    for (const name of [
      "publishReviewCreated",
      "publishReviewDeleted",
      "publishReviewLiked",
      "publishReviewCommented",
      "publishCommentLiked"
    ]) {
      mock.method(events, name, async () => {});
    }
  });

  afterEach(() => mock.restoreAll());

  describe("createReview", () => {
    it("crea la reseña con datos normalizados y publica el evento", async () => {
      const created = makeReview();
      mock.method(reviewsRepository, "findByUserAndGame", async () => null);
      mock.method(reviewsRepository, "countByGameId", async () => 0);
      const assertGame = mock.method(gamesClient, "assertGameExists", async () => {});
      const create = mock.method(reviewsRepository, "createReview", async () => created);

      const result = await service.createReview(validData, makeUser(), { token: "tkn" });

      assert.equal(result, created);
      assert.deepEqual(assertGame.mock.calls[0].arguments[0], { igdbId: 1942, token: "tkn" });
      assert.deepEqual(create.mock.calls[0].arguments[0], {
        authId: makeUser().authId,
        igdbId: 1942,
        rating: 4,
        title: "Título",
        content: "Contenido",
        image: null
      });
      assert.equal(events.publishReviewCreated.mock.callCount(), 1);
    });

    it("no consulta ms-games si el juego ya tiene reseñas", async () => {
      mock.method(reviewsRepository, "findByUserAndGame", async () => null);
      mock.method(reviewsRepository, "countByGameId", async () => 3);
      const assertGame = mock.method(gamesClient, "assertGameExists", async () => {});
      mock.method(reviewsRepository, "createReview", async () => makeReview());

      await service.createReview(validData, makeUser());

      assert.equal(assertGame.mock.callCount(), 0);
    });

    it("guarda title=null cuando viene vacío", async () => {
      mock.method(reviewsRepository, "findByUserAndGame", async () => null);
      mock.method(reviewsRepository, "countByGameId", async () => 1);
      const create = mock.method(reviewsRepository, "createReview", async () => makeReview());

      await service.createReview({ ...validData, title: "   " }, makeUser());

      assert.equal(create.mock.calls[0].arguments[0].title, null);
    });

    it("devuelve 409 si el usuario ya reseñó el juego", async () => {
      mock.method(reviewsRepository, "findByUserAndGame", async () => makeReview());
      const create = mock.method(reviewsRepository, "createReview", async () => {});

      await assert.rejects(service.createReview(validData, makeUser()), {
        status: 409,
        message: "Ya tienes una reseña para este videojuego"
      });
      assert.equal(create.mock.callCount(), 0);
    });

    it("traduce la violación de unicidad de Postgres (23505) a 409", async () => {
      mock.method(reviewsRepository, "findByUserAndGame", async () => null);
      mock.method(reviewsRepository, "countByGameId", async () => 1);
      mock.method(reviewsRepository, "createReview", async () => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      });

      await assert.rejects(service.createReview(validData, makeUser()), { status: 409 });
      assert.equal(events.publishReviewCreated.mock.callCount(), 0);
    });

    it("propaga otros errores del repositorio", async () => {
      mock.method(reviewsRepository, "findByUserAndGame", async () => null);
      mock.method(reviewsRepository, "countByGameId", async () => 1);
      mock.method(reviewsRepository, "createReview", async () => {
        throw new Error("db caída");
      });

      await assert.rejects(service.createReview(validData, makeUser()), { message: "db caída" });
    });

    it("propaga el 404 de ms-games si el juego no existe", async () => {
      mock.method(reviewsRepository, "findByUserAndGame", async () => null);
      mock.method(reviewsRepository, "countByGameId", async () => 0);
      mock.method(gamesClient, "assertGameExists", async () => {
        throw Object.assign(new Error("Videojuego no encontrado"), { status: 404 });
      });

      await assert.rejects(service.createReview(validData, makeUser()), { status: 404 });
    });

    const invalidCases = [
      [{ igdbId: "abc" }, "igdbId debe ser un entero mayor a 0"],
      [{ igdbId: 0 }, "igdbId debe ser un entero mayor a 0"],
      [{ igdbId: 2147483648 }, "igdbId debe ser un entero mayor a 0"],
      [{ rating: undefined }, "La calificación debe ser un entero entre 1 y 5"],
      [{ rating: "" }, "La calificación debe ser un entero entre 1 y 5"],
      [{ rating: 0 }, "La calificación debe ser un entero entre 1 y 5"],
      [{ rating: 6 }, "La calificación debe ser un entero entre 1 y 5"],
      [{ rating: 3.5 }, "La calificación debe ser un entero entre 1 y 5"],
      [{ content: "   " }, "El contenido de la reseña es obligatorio"],
      [{ content: 123 }, "El contenido de la reseña es obligatorio"],
      [{ title: 123 }, "El título debe ser texto"],
      [{ title: "a".repeat(151) }, "El título no puede superar 150 caracteres"]
    ];

    for (const [override, message] of invalidCases) {
      it(`rechaza ${JSON.stringify(override)} con 400`, async () => {
        const find = mock.method(reviewsRepository, "findByUserAndGame", async () => null);

        await assert.rejects(
          service.createReview({ ...validData, ...override }, makeUser()),
          { status: 400, message }
        );
        assert.equal(find.mock.callCount(), 0);
      });
    }
  });

  describe("getReviewsByGame", () => {
    it("devuelve reseñas, resumen y paginación", async () => {
      mock.method(reviewsRepository, "getGameRatingSummary", async () => ({
        total_reviews: 12,
        average_rating: "4.25"
      }));
      const find = mock.method(reviewsRepository, "findByGameId", async () => [makeReview()]);

      const result = await service.getReviewsByGame("1942", { page: "2", limit: "5" }, makeUser());

      assert.deepEqual(find.mock.calls[0].arguments, [
        1942,
        { page: 2, limit: 5, offset: 5 },
        makeUser().authId
      ]);
      assert.deepEqual(result.summary, { totalReviews: 12, averageRating: "4.25" });
      assert.equal(result.pagination.totalPages, 3);
      assert.equal(result.reviews.length, 1);
    });

    it("pasa authId=null para usuarios anónimos", async () => {
      mock.method(reviewsRepository, "getGameRatingSummary", async () => ({
        total_reviews: 0,
        average_rating: null
      }));
      const find = mock.method(reviewsRepository, "findByGameId", async () => []);

      await service.getReviewsByGame("1942", {});

      assert.equal(find.mock.calls[0].arguments[2], null);
    });

    it("rechaza un igdbId inválido", async () => {
      await assert.rejects(service.getReviewsByGame("x", {}), { status: 400 });
    });
  });

  describe("getReviewsByUser / getUserReviewsSummary", () => {
    it("devuelve las reseñas paginadas del usuario", async () => {
      mock.method(reviewsRepository, "countByUser", async () => 1);
      mock.method(reviewsRepository, "findByUser", async () => [makeReview()]);

      const result = await service.getReviewsByUser("abc", {});

      assert.equal(result.reviews.length, 1);
      assert.equal(result.pagination.total, 1);
    });

    it("devuelve el resumen del usuario", async () => {
      mock.method(reviewsRepository, "countByUser", async () => 4);
      mock.method(reviewsRepository, "countLikesReceivedByUser", async () => 9);

      assert.deepEqual(await service.getUserReviewsSummary("abc"), {
        authId: "abc",
        reviewsCount: 4,
        totalLikesReceived: 9
      });
    });

    for (const fn of ["getReviewsByUser", "getUserReviewsSummary"]) {
      it(`${fn} rechaza authId vacío`, async () => {
        await assert.rejects(service[fn]("   ", {}), {
          status: 400,
          message: "El authId es obligatorio"
        });
      });
    }
  });

  describe("getReviewById", () => {
    it("devuelve la reseña existente", async () => {
      const review = makeReview();
      mock.method(reviewsRepository, "findById", async () => review);

      assert.equal(await service.getReviewById("1"), review);
    });

    it("devuelve 404 si no existe", async () => {
      mock.method(reviewsRepository, "findById", async () => null);

      await assert.rejects(service.getReviewById("1"), {
        status: 404,
        message: "Reseña no encontrada"
      });
    });
  });

  describe("canEditReview", () => {
    it("permite al autor dentro de la ventana de edición", () => {
      assert.equal(service.canEditReview(makeReview({ created_at: minutesAgo(5) }), makeUser()), true);
    });

    it("rechaza al autor fuera de la ventana", () => {
      assert.equal(service.canEditReview(makeReview({ created_at: minutesAgo(31) }), makeUser()), false);
    });

    it("rechaza a otro usuario", () => {
      assert.equal(
        service.canEditReview(makeReview(), makeUser({ authId: OTHER_AUTH_ID })),
        false
      );
    });
  });

  describe("updateReview", () => {
    const body = { rating: 3, title: "Nuevo", content: "Editado" };

    it("actualiza la reseña del autor sin imagen", async () => {
      const updated = makeReview({ rating: 3 });
      mock.method(reviewsRepository, "findById", async () => makeReview());
      const update = mock.method(reviewsRepository, "updateReview", async () => updated);
      const updateImage = mock.method(reviewsRepository, "updateReviewImageData", async () => {});

      assert.equal(await service.updateReview("1", body, makeUser()), updated);
      assert.deepEqual(update.mock.calls[0].arguments[0], {
        reviewId: 1,
        rating: 3,
        title: "Nuevo",
        content: "Editado"
      });
      assert.equal(updateImage.mock.callCount(), 0);
    });

    it("también actualiza la imagen si se envía", async () => {
      const image = { data: Buffer.from("x"), mimeType: "image/png", size: 1 };
      const withImage = makeReview({ image_mime_type: "image/png" });
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(reviewsRepository, "updateReview", async () => makeReview());
      const updateImage = mock.method(reviewsRepository, "updateReviewImageData", async () => withImage);

      assert.equal(await service.updateReview("1", { ...body, image }, makeUser()), withImage);
      assert.deepEqual(updateImage.mock.calls[0].arguments[0], { reviewId: 1, image });
    });

    it("devuelve 403 si no es el autor", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());

      await assert.rejects(
        service.updateReview("1", body, makeUser({ authId: OTHER_AUTH_ID, role: "ADMIN" })),
        { status: 403, message: "Solo el autor puede editar su reseña" }
      );
    });

    it("devuelve 403 si pasó la ventana de edición", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview({ created_at: minutesAgo(45) }));
      const update = mock.method(reviewsRepository, "updateReview", async () => {});

      await assert.rejects(service.updateReview("1", body, makeUser()), {
        status: 403,
        message: "Solo puedes editar tu reseña durante los primeros 30 minutos"
      });
      assert.equal(update.mock.callCount(), 0);
    });

    it("valida los datos nuevos", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());

      await assert.rejects(service.updateReview("1", { ...body, rating: 9 }, makeUser()), {
        status: 400
      });
    });
  });

  describe("deleteReview", () => {
    it("el autor puede eliminar y se publica el evento", async () => {
      const review = makeReview();
      mock.method(reviewsRepository, "findById", async () => review);
      const del = mock.method(reviewsRepository, "deleteReview", async () => true);

      assert.deepEqual(await service.deleteReview("1", makeUser()), {
        message: "Reseña eliminada correctamente"
      });
      assert.equal(del.mock.calls[0].arguments[0], 1);
      assert.deepEqual(events.publishReviewDeleted.mock.calls[0].arguments[0], {
        review,
        actorAuthId: makeUser().authId
      });
    });

    it("un ADMIN puede eliminar reseñas ajenas", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(reviewsRepository, "deleteReview", async () => true);

      await service.deleteReview("1", makeUser({ authId: OTHER_AUTH_ID, role: "ADMIN" }));
    });

    it("otro usuario recibe 403", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      const del = mock.method(reviewsRepository, "deleteReview", async () => true);

      await assert.rejects(service.deleteReview("1", makeUser({ authId: OTHER_AUTH_ID })), {
        status: 403
      });
      assert.equal(del.mock.callCount(), 0);
    });
  });

  describe("imágenes", () => {
    const image = { data: Buffer.from("x"), mimeType: "image/png", size: 1 };

    it("removeReviewImage: autor o ADMIN quitan la imagen", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      const upd = mock.method(reviewsRepository, "updateReviewImage", async () => makeReview());

      const result = await service.removeReviewImage("1", makeUser({ authId: OTHER_AUTH_ID, role: "ADMIN" }));

      assert.equal(result.imageUrl, null);
      assert.deepEqual(upd.mock.calls[0].arguments[0], { reviewId: 1, imageUrl: null });
    });

    it("removeReviewImage: otro usuario recibe 403", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());

      await assert.rejects(service.removeReviewImage("1", makeUser({ authId: OTHER_AUTH_ID })), {
        status: 403
      });
    });

    it("addReviewImage: solo el autor (ni siquiera ADMIN)", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      const upd = mock.method(reviewsRepository, "updateReviewImageData", async () => "ok");

      assert.equal(await service.addReviewImage("1", image, makeUser()), "ok");
      await assert.rejects(
        service.addReviewImage("1", image, makeUser({ authId: OTHER_AUTH_ID, role: "ADMIN" })),
        { status: 403 }
      );
      assert.equal(upd.mock.callCount(), 1);
    });

    it("getReviewImage devuelve la imagen o 404", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      const getImage = mock.method(reviewsRepository, "getReviewImage", async () => ({ image_data: "x" }));

      assert.deepEqual(await service.getReviewImage("1"), { image_data: "x" });

      getImage.mock.mockImplementation(async () => null);
      await assert.rejects(service.getReviewImage("1"), {
        status: 404,
        message: "La reseña no tiene imagen"
      });
    });
  });

  describe("likes", () => {
    it("likeReview agrega like y publica evento", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(reviewsRepository, "likeReview", async () => ({ id: 1 }));

      assert.deepEqual(await service.likeReview("1", makeUser()), {
        message: "Like agregado correctamente"
      });
      assert.equal(events.publishReviewLiked.mock.callCount(), 1);
    });

    it("likeReview repetido no publica evento", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(reviewsRepository, "likeReview", async () => null);

      assert.deepEqual(await service.likeReview("1", makeUser()), {
        message: "Ya habías dado like a esta reseña"
      });
      assert.equal(events.publishReviewLiked.mock.callCount(), 0);
    });

    it("unlikeReview elimina el like o devuelve 404", async () => {
      const unlike = mock.method(reviewsRepository, "unlikeReview", async () => true);

      assert.deepEqual(await service.unlikeReview("1", makeUser()), {
        message: "Like eliminado correctamente"
      });
      assert.deepEqual(unlike.mock.calls[0].arguments[0], { reviewId: 1, authId: makeUser().authId });

      unlike.mock.mockImplementation(async () => null);
      await assert.rejects(service.unlikeReview("1", makeUser()), { status: 404 });
    });

    it("getReviewLikes devuelve el conteo", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(reviewsRepository, "countLikes", async () => 7);

      assert.deepEqual(await service.getReviewLikes("1"), { reviewId: 1, likesCount: 7 });
    });
  });
});
