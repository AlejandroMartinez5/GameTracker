const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadWithMocks } = require("../helpers.cjs");

const input = {
  recipientAuthId: " user-1 ", actorAuthId: " admin-1 ", type: " report.created ",
  title: " Reporte recibido ", body: " Tu reporte quedó pendiente. ", eventId: " evt-1 "
};
const row = { id: 42, recipient_auth_id: "user-1" };

function buildService(t, overrides = {}) {
  const repo = {
    create: t.mock.fn(async () => row),
    countByRecipient: t.mock.fn(async () => 25),
    findByRecipient: t.mock.fn(async () => [row]),
    countUnread: t.mock.fn(async () => 3),
    markAsRead: t.mock.fn(async () => row),
    markAllAsRead: t.mock.fn(async () => [row]),
    remove: t.mock.fn(async () => row),
    ...overrides
  };
  const service = loadWithMocks(path.join(__dirname, "../../src/services/notifications.service.js"), {
    "../repositories/notifications.repository": repo
  });
  return { service, repo };
}

describe("creación de notificaciones", () => {
  it("normaliza los datos y conserva el identificador del evento", async (t) => {
    const { service, repo } = buildService(t);

    assert.equal(await service.createEventNotification(input), row);
    assert.deepEqual(repo.create.mock.calls[0].arguments, [{
      recipientAuthId: "user-1", actorAuthId: "admin-1", type: "report.created",
      title: "Reporte recibido", body: "Tu reporte quedó pendiente.", metadata: {}, eventId: "evt-1"
    }]);
  });

  it("omite eventos sin destinatario", async (t) => {
    const { service, repo } = buildService(t);

    assert.equal(await service.createEventNotification({ type: "report.created" }), null);
    assert.equal(repo.create.mock.callCount(), 0);
  });

  for (const invalid of [{ recipientAuthId: " " }, { metadata: [] }, { title: "a".repeat(141) }]) {
    it("rechaza un valor inválido en " + Object.keys(invalid)[0], async (t) => {
      const { service, repo } = buildService(t);

      await assert.rejects(service.createNotification({ ...input, ...invalid }), { status: 400 });
      assert.equal(repo.create.mock.callCount(), 0);
    });
  }
});

describe("consulta y gestión de notificaciones", () => {
  it("aplica los mismos filtros al conteo y al listado paginado", async (t) => {
    const { service, repo } = buildService(t);
    const result = await service.getNotifications(" user-1 ", {
      status: "unread", type: " report.created ", page: "2", limit: "10"
    });
    const filters = { status: "unread", type: "report.created" };

    assert.deepEqual(repo.countByRecipient.mock.calls[0].arguments, ["user-1", filters]);
    assert.deepEqual(repo.findByRecipient.mock.calls[0].arguments, [
      "user-1", filters, { page: 2, limit: 10, offset: 10 }
    ]);
    assert.deepEqual(result, {
      data: [row],
      pagination: { page: 2, limit: 10, total: 25, totalPages: 3, hasNextPage: true, hasPreviousPage: true }
    });
  });

  it("rechaza filtros y límites inválidos antes de consultar", async (t) => {
    const { service, repo } = buildService(t);

    for (const query of [{ status: "pending" }, { limit: 101 }]) {
      await assert.rejects(service.getNotifications("user-1", query), { status: 400 });
    }
    assert.equal(repo.countByRecipient.mock.callCount(), 0);
    assert.equal(repo.findByRecipient.mock.callCount(), 0);
  });

  it("devuelve el conteo de no leídas y cuántas se marcaron como leídas", async (t) => {
    const { service, repo } = buildService(t);

    assert.deepEqual(await service.getUnreadCount(" user-1 "), { unreadCount: 3 });
    assert.deepEqual(await service.markAllAsRead(" user-1 "), { updated: 1, notifications: [row] });
    assert.deepEqual(repo.countUnread.mock.calls[0].arguments, ["user-1"]);
    assert.deepEqual(repo.markAllAsRead.mock.calls[0].arguments, ["user-1"]);
  });

  for (const [operation, method] of [["markAsRead", "markAsRead"], ["deleteNotification", "remove"]]) {
    it(operation + " pasa el identificador y el destinatario al repositorio", async (t) => {
      const { service, repo } = buildService(t);

      assert.equal(await service[operation](" user-1 ", "42"), row);
      assert.deepEqual(repo[method].mock.calls[0].arguments, [42, "user-1"]);
      await assert.rejects(service[operation]("user-1", "0"), { status: 400 });
      assert.equal(repo[method].mock.callCount(), 1);
    });

    it(operation + " devuelve 404 cuando no hay una notificación del destinatario", async (t) => {
      const { service } = buildService(t, { [method]: async () => null });

      await assert.rejects(service[operation]("user-1", 42), { status: 404 });
    });
  }
});
