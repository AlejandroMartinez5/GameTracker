const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../helpers.cjs");

const requester = "user-1";
const receiver = "user-2";
const pending = { id: 42, requester_auth_id: requester, receiver_auth_id: receiver, status: "PENDING" };
const accepted = { ...pending, status: "ACCEPTED" };

function buildService(t, overrides = {}) {
  const repository = {
    findActiveBetweenUsers: t.mock.fn(async () => null),
    createRequest: t.mock.fn(async () => pending),
    findById: t.mock.fn(async () => pending),
    updateStatus: t.mock.fn(async ({ status }) => ({ ...pending, status })),
    deletePendingRequestById: t.mock.fn(async () => pending),
    deleteAcceptedBetweenUsers: t.mock.fn(async () => accepted),
    ...overrides
  };
  const events = {
    publishFriendRequestReceived: t.mock.fn(async () => {}),
    publishFriendRequestAccepted: t.mock.fn(async () => {}),
    publishFriendRequestRejected: t.mock.fn(async () => {}),
    publishFriendAccepted: t.mock.fn(async () => {}),
    publishFriendRemoved: t.mock.fn(async () => {})
  };
  const service = loadWithMocks("services/friends.service.js", {
    "../repositories/friends.repository": repository,
    "../utils/notification-events.util": events
  });
  return { service, repository, events };
}

describe("sendFriendRequest", () => {
  it("normaliza los IDs, crea la solicitud y notifica al destinatario", async (t) => {
    const { service, repository, events } = buildService(t);

    assert.equal(await service.sendFriendRequest(" user-1 ", " user-2 "), pending);
    assert.deepEqual(repository.findActiveBetweenUsers.mock.calls[0].arguments, [requester, receiver]);
    assert.deepEqual(repository.createRequest.mock.calls[0].arguments, [{
      requesterAuthId: requester, receiverAuthId: receiver
    }]);
    assert.deepEqual(events.publishFriendRequestReceived.mock.calls[0].arguments, [pending]);
  });

  it("rechaza una solicitud al propio usuario antes de consultar el repositorio", async (t) => {
    const { service, repository } = buildService(t);

    await assert.rejects(service.sendFriendRequest(requester, " user-1 "), { status: 400 });
    assert.equal(repository.findActiveBetweenUsers.mock.callCount(), 0);
  });

  for (const relationship of [pending, accepted]) {
    it("devuelve 409 si ya existe una relación " + relationship.status, async (t) => {
      const { service, repository, events } = buildService(t, {
        findActiveBetweenUsers: async () => relationship
      });

      await assert.rejects(service.sendFriendRequest(requester, receiver), { status: 409 });
      assert.equal(repository.createRequest.mock.callCount(), 0);
      assert.equal(events.publishFriendRequestReceived.mock.callCount(), 0);
    });
  }

  it("traduce un conflicto de unicidad a 409 sin publicar la solicitud", async (t) => {
    const { service, events } = buildService(t, {
      createRequest: async () => { throw Object.assign(new Error("Duplicado"), { code: "23505" }); }
    });

    await assert.rejects(service.sendFriendRequest(requester, receiver), { status: 409 });
    assert.equal(events.publishFriendRequestReceived.mock.callCount(), 0);
  });
});

for (const [method, status, event] of [
  ["acceptFriendRequest", "ACCEPTED", "publishFriendRequestAccepted"],
  ["rejectFriendRequest", "REJECTED", "publishFriendRequestRejected"]
]) {
  describe(method, () => {
    it("actualiza la solicitud del destinatario y publica los eventos correspondientes", async (t) => {
      const { service, repository, events } = buildService(t);
      const result = await service[method](" user-2 ", "42");

      assert.deepEqual(result, { ...pending, status });
      assert.deepEqual(repository.updateStatus.mock.calls[0].arguments, [{
        requestId: 42, receiverAuthId: receiver, status
      }]);
      assert.deepEqual(events[event].mock.calls[0].arguments, [result]);
      if (status === "ACCEPTED") {
        assert.deepEqual(events.publishFriendAccepted.mock.calls[0].arguments, [result]);
      } else {
        assert.equal(events.publishFriendAccepted.mock.callCount(), 0);
      }
    });

    it("rechaza IDs inválidos, solicitudes ajenas, inexistentes o resueltas", async (t) => {
      const { service, repository } = buildService(t, {
        findById: t.mock.fn(async (id) => id === 42 ? pending : id === 43 ? accepted : null)
      });

      await assert.rejects(service[method](receiver, 0), { status: 400 });
      assert.equal(repository.findById.mock.callCount(), 0);
      await assert.rejects(service[method](requester, 42), { status: 403 });
      await assert.rejects(service[method](receiver, 44), { status: 404 });
      await assert.rejects(service[method](receiver, 43), { status: 409 });
      assert.equal(repository.updateStatus.mock.callCount(), 0);
    });

    it("omite eventos si la solicitud deja de estar pendiente durante la actualización", async (t) => {
      const { service, events } = buildService(t, { updateStatus: async () => null });

      await assert.rejects(service[method](receiver, 42), { status: 409 });
      assert.equal(events[event].mock.callCount(), 0);
      assert.equal(events.publishFriendAccepted.mock.callCount(), 0);
    });
  });
}

describe("cancelFriendRequest", () => {
  it("permite cancelar solo al solicitante", async (t) => {
    const { service, repository } = buildService(t);

    await assert.rejects(service.cancelFriendRequest(receiver, 42), { status: 403 });
    assert.equal(repository.deletePendingRequestById.mock.callCount(), 0);
    assert.equal(await service.cancelFriendRequest(requester, "42"), pending);
    assert.deepEqual(repository.deletePendingRequestById.mock.calls[0].arguments, [42]);
  });
});

describe("removeFriend", () => {
  it("elimina y publica el evento de amistad", async (t) => {
    const { service, repository, events } = buildService(t);

    assert.equal(await service.removeFriend(requester, receiver), accepted);
    assert.deepEqual(repository.deleteAcceptedBetweenUsers.mock.calls[0].arguments, [requester, receiver]);
    assert.deepEqual(events.publishFriendRemoved.mock.calls[0].arguments, [accepted]);
  });

  it("devuelve 404 y omite el evento cuando no existe la amistad", async (t) => {
    const { service, events } = buildService(t, { deleteAcceptedBetweenUsers: async () => null });

    await assert.rejects(service.removeFriend(requester, receiver), { status: 404 });
    assert.equal(events.publishFriendRemoved.mock.callCount(), 0);
  });
});

describe("getRelationshipStatus", () => {
  for (const [user, other, relationship, status] of [
    [requester, receiver, null, "NONE"],
    [requester, receiver, pending, "PENDING_OUTGOING"],
    [receiver, requester, pending, "PENDING_INCOMING"],
    [receiver, requester, accepted, "FRIENDS"],
    [requester, requester, null, "SELF"]
  ]) {
    it("devuelve " + status + " según la relación y su dirección", async (t) => {
      const lookup = t.mock.fn(async () => relationship);
      const { service } = buildService(t, { findActiveBetweenUsers: lookup });

      assert.deepEqual(await service.getRelationshipStatus(user, other), { status, relationship });
      assert.deepEqual(lookup.mock.calls.map((call) => call.arguments), status === "SELF" ? [] : [[user, other]]);
    });
  }
});

describe("listados de amigos y solicitudes", () => {
  for (const [method, count, find] of [
    ["getFriends", "countFriends", "findFriends"],
    ["getPublicFriends", "countFriends", "findFriends"],
    ["getIncomingRequests", "countIncomingRequests", "findIncomingRequests"],
    ["getOutgoingRequests", "countOutgoingRequests", "findOutgoingRequests"]
  ]) {
    it(method + " devuelve los datos paginados del usuario", async (t) => {
      const data = [{ id: 42 }];
      const { service, repository } = buildService(t, {
        [count]: t.mock.fn(async () => 11),
        [find]: t.mock.fn(async () => data)
      });
      const result = await service[method](" user-1 ", { page: "2", limit: "5" });

      assert.deepEqual(repository[count].mock.calls[0].arguments, [requester]);
      assert.deepEqual(repository[find].mock.calls[0].arguments, [
        requester, { page: 2, limit: 5, offset: 5 }
      ]);
      assert.deepEqual(result, {
        data,
        pagination: {
          page: 2, limit: 5, total: 11, totalPages: 3,
          hasNextPage: true, hasPreviousPage: true, nextPage: 3, previousPage: 1
        }
      });
    });
  }
});
