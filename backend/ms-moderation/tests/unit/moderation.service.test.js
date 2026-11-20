const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const moderationRepository = require("../../src/repositories/moderation.repository");
const users = require("../../src/clients/users.client");
const auth = require("../../src/clients/auth.client");
const reviews = require("../../src/clients/reviews.client");
const service = require("../../src/services/moderation.service");

const pendingReport = {
  id: 10,
  status: "PENDING",
  target_type: "USER",
  target_id: "target-auth",
  reason: "SPAM"
};

const buildService = (t, overrides = {}) => {
  const repository = {
    createReport: async (data) => ({ id: 1, ...data }),
    countReports: async () => 1,
    findReports: async () => [pendingReport],
    findReportById: async () => pendingReport,
    getAdminStats: async () => ({ pending: 1 }),
    completePendingReportWithAction: async (data) => ({ id: data.reportId, ...data }),
    ...overrides.repository
  };

  const usersClient = {
    getPublicProfile: async () => ({
      authId: "target-auth",
      name: "Ana",
      username: "ana",
      profileImage: null,
      createdAt: "created"
    }),
    removeProfilePhoto: async () => ({ ok: true }),
    ...overrides.usersClient
  };

  const authClient = {
    suspendUser: async () => ({ accountStatus: "SUSPENDED" }),
    banUser: async () => ({ accountStatus: "BANNED" }),
    ...overrides.authClient
  };

  const reviewsClient = {
    getReview: async () => ({}),
    getComment: async () => ({}),
    deleteReview: async () => ({ deleted: true }),
    deleteComment: async () => ({ deleted: true }),
    removeReviewImage: async () => ({ deleted: true }),
    removeCommentImage: async () => ({ deleted: true }),
    ...overrides.reviewsClient
  };

  for (const [name, implementation] of Object.entries(repository)) {
    t.mock.method(moderationRepository, name, implementation);
  }
  for (const [name, implementation] of Object.entries(usersClient)) {
    t.mock.method(users, name, implementation);
  }
  for (const [name, implementation] of Object.entries(authClient)) {
    t.mock.method(auth, name, implementation);
  }
  for (const [name, implementation] of Object.entries(reviewsClient)) {
    t.mock.method(reviews, name, implementation);
  }

  return { service, repository: moderationRepository, usersClient: users, authClient: auth, reviewsClient: reviews };
};

describe("createReport", () => {
  it("arma snapshot del usuario reportado y guarda el reporte", async (t) => {
    const { service, repository, usersClient } = buildService(t);

    const result = await service.createReport(
      {
        targetType: " user ",
        targetId: " target-auth ",
        reason: " spam ",
        description: " perfil falso "
      },
      { authId: "reporter-auth" },
      "token"
    );

    assert.equal(result.targetType, "USER");
    assert.equal(result.reason, "SPAM");
    assert.equal(repository.createReport.mock.callCount(), 1);
    assert.equal(usersClient.getPublicProfile.mock.calls[0].arguments[0].authId, "target-auth");
  });

  it("evita reportarse a si mismo", async (t) => {
    const { service, repository } = buildService(t);

    await assert.rejects(
      () =>
        service.createReport(
          { targetType: "USER", targetId: "same-auth", reason: "SPAM" },
          { authId: "same-auth" },
          "token"
        ),
      { status: 400 }
    );
    assert.equal(repository.createReport.mock.callCount(), 0);
  });

  it("arma snapshot de resena", async (t) => {
    const { service, repository, reviewsClient } = buildService(t, {
      reviewsClient: {
        getReview: t.mock.fn(async () => ({
          id: 5,
          auth_id: "author-1",
          igdb_id: 82,
          rating: 5,
          title: "Titulo",
          content: "Contenido",
          image_url: "https://img.test/review.png",
          created_at: "created",
          updated_at: "updated"
        }))
      }
    });

    await service.createReport(
      { targetType: "REVIEW", targetId: 5, reason: "SPOILER" },
      { authId: "reporter-auth" },
      "token"
    );

    assert.equal(reviewsClient.getReview.mock.callCount(), 1);
    assert.equal(repository.createReport.mock.calls[0].arguments[0].targetSnapshot.type, "REVIEW");
    assert.equal(repository.createReport.mock.calls[0].arguments[0].targetSnapshot.igdbId, 82);
  });

  it("convierte reporte duplicado en 409", async (t) => {
    const { service } = buildService(t, {
      repository: {
        createReport: t.mock.fn(async () => {
          const error = new Error("duplicate");
          error.code = "23505";
          throw error;
        })
      }
    });

    await assert.rejects(
      () =>
        service.createReport(
          { targetType: "USER", targetId: "target-auth", reason: "SPAM" },
          { authId: "reporter-auth" },
          "token"
        ),
      { status: 409 }
    );
  });

  for (const payload of [
    { targetType: 42, targetId: 1, reason: "SPAM" },
    { targetType: "REVIEW", targetId: -1, reason: "SPAM" },
    { targetType: "COMMENT", targetId: 1.5, reason: "SPAM" },
    { targetType: "USER", targetId: "target-auth", reason: {} },
    { targetType: "USER", targetId: "target-auth", reason: "SPAM", description: [] }
  ]) {
    it(`rechaza datos inválidos: ${JSON.stringify(payload)}`, async (t) => {
      const { service, repository } = buildService(t);
      await assert.rejects(() => service.createReport(payload, { authId: "reporter" }, "token"), { status: 400 });
      assert.equal(repository.createReport.mock.callCount(), 0);
    });
  }
});

describe("getAdminReports", () => {
  it("enriquece acciones disponibles", async (t) => {
    const { service } = buildService(t);

    const result = await service.getAdminReports({ status: "all" });

    assert.deepEqual(result.reports[0].availableActions, [
      "SUSPEND_USER",
      "BAN_USER",
      "DISMISS_REPORT"
    ]);
  });
});

describe("executeAction", () => {
  it("suspende usuario y registra metadatos", async (t) => {
    const { service, repository, authClient } = buildService(t);

    const result = await service.executeAction(
      {
        reportId: 10,
        actionType: "SUSPEND_USER",
        duration: "1_DAY",
        note: " spam "
      },
      { authId: "admin-1" },
      "token"
    );

    assert.equal(authClient.suspendUser.mock.callCount(), 1);
    assert.equal(result.status, "ACTION_TAKEN");
    assert.equal(repository.completePendingReportWithAction.mock.calls[0].arguments[0].adminNote, "spam");
    assert.ok(result.metadata.suspendedUntil);
  });

  it("rechaza accion incompatible con tipo de reporte", async (t) => {
    const { service, authClient } = buildService(t, {
      repository: {
        findReportById: t.mock.fn(async () => ({
          ...pendingReport,
          target_type: "REVIEW",
          target_id: "5"
        }))
      }
    });

    await assert.rejects(
      () =>
        service.executeAction(
          { reportId: 10, actionType: "BAN_USER" },
          { authId: "admin-1" },
          "token"
        ),
      { status: 400 }
    );
    assert.equal(authClient.banUser.mock.callCount(), 0);
  });

  it("elimina resena reportada mediante reviews client", async (t) => {
    const { service, reviewsClient, repository } = buildService(t, {
      repository: {
        findReportById: t.mock.fn(async () => ({
          ...pendingReport,
          target_type: "REVIEW",
          target_id: "5"
        }))
      }
    });

    const result = await service.executeAction(
      { reportId: 10, actionType: "DELETE_REVIEW", note: "viola reglas" },
      { authId: "admin-1" },
      "token"
    );

    assert.equal(reviewsClient.deleteReview.mock.callCount(), 1);
    assert.equal(result.actionType, "DELETE_REVIEW");
    assert.equal(repository.completePendingReportWithAction.mock.callCount(), 1);
  });

  it("no resuelve el reporte si falla el servicio externo", async (t) => {
    const { service, repository } = buildService(t, { authClient: {
        banUser: async () => {
          throw Object.assign(new Error("unavailable"), { status: 502 });
        }
      } });
    await assert.rejects(() => service.executeAction({ reportId: 10, actionType: "BAN_USER" }, { authId: "admin" }, "token"), { status: 502 });
    assert.equal(repository.completePendingReportWithAction.mock.callCount(), 0);
  });
  it("rechaza duraciones heredadas del prototipo", async (t) => {
    const { service, authClient } = buildService(t);
    await assert.rejects(() => service.executeAction({ reportId: 10, actionType: "SUSPEND_USER", duration: "__proto__" }, { authId: "admin" }, "token"), { status: 400 });
    assert.equal(authClient.suspendUser.mock.callCount(), 0);
  });
});

describe("dismissReport", () => {
  it("solo procesa reportes pendientes", async (t) => {
    const { service, repository } = buildService(t);

    const result = await service.dismissReport(
      { reportId: 10, note: " sin problema " },
      { authId: "admin-1" }
    );

    assert.equal(result.status, "DISMISSED");
    assert.equal(repository.completePendingReportWithAction.mock.calls[0].arguments[0].adminNote, "sin problema");
  });
});

describe("getAdminReportById", () => {
  it("rechaza identificadores no enteros positivos", async (t) => {
    const { service, repository } = buildService(t);
    for (const id of [-1, 0, 1.5, "abc", 2147483648]) {
      await assert.rejects(() => service.getAdminReportById(id), { status: 400 });
    }
    assert.equal(repository.findReportById.mock.callCount(), 0);
  });
});
