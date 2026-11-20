const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const commentsRepository = require("../../src/repositories/comments.repository");
const reviewsRepository = require("../../src/repositories/reviews.repository");
const events = require("../../src/utils/events.util");
const service = require("../../src/services/comments.service");
const { makeUser, makeReview, makeComment, OTHER_AUTH_ID } = require("../helpers");

const otherUser = makeUser({ authId: OTHER_AUTH_ID });
const admin = makeUser({ authId: OTHER_AUTH_ID, role: "ADMIN" });

describe("comments.service", () => {
  beforeEach(() => {
    mock.method(events, "publishReviewCommented", async () => {});
    mock.method(events, "publishCommentLiked", async () => {});
  });

  afterEach(() => mock.restoreAll());

  describe("createComment", () => {
    it("crea el comentario con el contenido recortado y publica evento", async () => {
      const review = makeReview();
      const comment = makeComment();
      mock.method(reviewsRepository, "findById", async () => review);
      const create = mock.method(commentsRepository, "createComment", async () => comment);

      assert.equal(await service.createComment("1", { content: "  hola  " }, makeUser()), comment);
      assert.deepEqual(create.mock.calls[0].arguments[0], {
        reviewId: 1,
        authId: makeUser().authId,
        content: "hola",
        image: null
      });
      assert.deepEqual(events.publishReviewCommented.mock.calls[0].arguments[0], { review, comment });
    });

    it("devuelve 404 si la reseña no existe", async () => {
      mock.method(reviewsRepository, "findById", async () => null);

      await assert.rejects(service.createComment("1", { content: "hola" }, makeUser()), {
        status: 404,
        message: "Reseña no encontrada"
      });
    });

    for (const content of [undefined, "", "   ", 42]) {
      it(`rechaza content=${JSON.stringify(content)} con 400`, async () => {
        mock.method(reviewsRepository, "findById", async () => makeReview());
        const create = mock.method(commentsRepository, "createComment", async () => {});

        await assert.rejects(service.createComment("1", { content }, makeUser()), {
          status: 400,
          message: "El contenido del comentario es obligatorio"
        });
        assert.equal(create.mock.callCount(), 0);
      });
    }

    it("rechaza reviewId inválido", async () => {
      await assert.rejects(service.createComment("-3", { content: "x" }, makeUser()), {
        status: 400,
        message: "reviewId debe ser un entero mayor a 0"
      });
    });
  });

  describe("getCommentsByReview", () => {
    it("devuelve comentarios paginados", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(commentsRepository, "countByReviewId", async () => 11);
      const find = mock.method(commentsRepository, "findByReviewId", async () => [makeComment()]);

      const result = await service.getCommentsByReview("1", { page: "2" }, makeUser());

      assert.deepEqual(find.mock.calls[0].arguments, [
        1,
        { page: 2, limit: 10, offset: 10 },
        makeUser().authId
      ]);
      assert.equal(result.pagination.totalPages, 2);
      assert.equal(result.pagination.hasNextPage, false);
    });

    it("usa authId=null sin usuario", async () => {
      mock.method(reviewsRepository, "findById", async () => makeReview());
      mock.method(commentsRepository, "countByReviewId", async () => 0);
      const find = mock.method(commentsRepository, "findByReviewId", async () => []);

      await service.getCommentsByReview("1", {});

      assert.equal(find.mock.calls[0].arguments[2], null);
    });
  });

  describe("getCommentById", () => {
    it("devuelve 404 si no existe", async () => {
      mock.method(commentsRepository, "findById", async () => null);

      await assert.rejects(service.getCommentById("10"), {
        status: 404,
        message: "Comentario no encontrado"
      });
    });
  });

  describe("deleteComment", () => {
    it("lo puede eliminar el autor", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      const del = mock.method(commentsRepository, "deleteComment", async () => true);

      assert.deepEqual(await service.deleteComment("10", makeUser()), {
        message: "Comentario eliminado correctamente"
      });
      assert.equal(del.mock.calls[0].arguments[0], 10);
    });

    it("lo puede eliminar un ADMIN", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      mock.method(commentsRepository, "deleteComment", async () => true);

      await service.deleteComment("10", admin);
    });

    it("otro usuario recibe 403", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      const del = mock.method(commentsRepository, "deleteComment", async () => true);

      await assert.rejects(service.deleteComment("10", otherUser), { status: 403 });
      assert.equal(del.mock.callCount(), 0);
    });
  });

  describe("imágenes", () => {
    const image = { data: Buffer.from("x"), mimeType: "image/jpeg", size: 1 };

    it("removeCommentImage devuelve el comentario actualizado", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      mock.method(commentsRepository, "updateCommentImage", async () => "updated");

      assert.deepEqual(await service.removeCommentImage("10", makeUser()), {
        commentId: 10,
        reviewId: 1,
        imageUrl: null,
        comment: "updated"
      });
    });

    it("removeCommentImage: otro usuario recibe 403", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());

      await assert.rejects(service.removeCommentImage("10", otherUser), { status: 403 });
    });

    it("addCommentImage: autor o ADMIN", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      const upd = mock.method(commentsRepository, "updateCommentImageData", async () => "ok");

      assert.equal(await service.addCommentImage("10", image, admin), "ok");
      assert.deepEqual(upd.mock.calls[0].arguments[0], { commentId: 10, image });
      await assert.rejects(service.addCommentImage("10", image, otherUser), { status: 403 });
    });

    it("getCommentImage devuelve 404 si no tiene imagen", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      mock.method(commentsRepository, "getCommentImage", async () => null);

      await assert.rejects(service.getCommentImage("10"), {
        status: 404,
        message: "El comentario no tiene imagen"
      });
    });
  });

  describe("likes", () => {
    it("likeComment agrega like y publica evento", async () => {
      const comment = makeComment();
      mock.method(commentsRepository, "findById", async () => comment);
      mock.method(commentsRepository, "likeComment", async () => ({ id: 1 }));

      assert.deepEqual(await service.likeComment("10", otherUser), {
        message: "Like agregado correctamente"
      });
      assert.deepEqual(events.publishCommentLiked.mock.calls[0].arguments[0], {
        comment,
        actorAuthId: OTHER_AUTH_ID
      });
    });

    it("likeComment repetido no publica evento", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      mock.method(commentsRepository, "likeComment", async () => null);

      assert.deepEqual(await service.likeComment("10", makeUser()), {
        message: "Ya habías dado like a este comentario"
      });
      assert.equal(events.publishCommentLiked.mock.callCount(), 0);
    });

    it("unlikeComment devuelve 404 si no había like", async () => {
      mock.method(commentsRepository, "unlikeComment", async () => null);

      await assert.rejects(service.unlikeComment("10", makeUser()), {
        status: 404,
        message: "No habías dado like a este comentario"
      });
    });

    it("getCommentLikes devuelve el conteo", async () => {
      mock.method(commentsRepository, "findById", async () => makeComment());
      mock.method(commentsRepository, "countLikes", async () => 2);

      assert.deepEqual(await service.getCommentLikes("10"), { commentId: 10, likesCount: 2 });
    });
  });
});
