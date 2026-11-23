const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { AUTH_ID, ADMIN_ID, loadWithMocks, mockRes } = require("../helpers.cjs");

const user = { _id: AUTH_ID, role: "USER", accountStatus: "ACTIVE" };

function buildService(t, target = user) {
  const model = {
    findById: t.mock.fn(async () => target),
    findByIdAndUpdate: t.mock.fn(async (id, update) => ({ _id: id, ...update.$set }))
  };
  const publishModerationNotification = t.mock.fn();
  const service = loadWithMocks("services/moderation.service.js", {
    mongoose: { isObjectIdOrHexString: (id) => /^[a-f0-9]{24}$/i.test(id) },
    "../models/user.model": model,
    "../utils/user-events.util": { publishModerationNotification }
  });
  return { service, model, publishModerationNotification };
}

const request = {
  params: { authId: AUTH_ID, action: "suspend" },
  user: { sub: ADMIN_ID }
};

describe("moderate", () => {
  it("guarda la suspensión con auditoría y notifica al usuario", async (t) => {
    const { service, model, publishModerationNotification } = buildService(t);
    const suspendedUntil = new Date(Date.now() + 86_400_000);
    const res = mockRes();
    await service.moderate({
      ...request,
      body: { suspendedUntil: suspendedUntil.toISOString(), reason: " spam " }
    }, res);

    const [id, { $set }] = model.findByIdAndUpdate.mock.calls[0].arguments;
    assert.equal(id, AUTH_ID);
    assert.equal($set.accountStatus, "SUSPENDED");
    assert.deepEqual($set.suspendedUntil, suspendedUntil);
    assert.equal($set.moderatedByAuthId, ADMIN_ID);
    assert.equal($set.moderationReason, "spam");
    const [notification] = publishModerationNotification.mock.calls[0].arguments;
    assert.equal(notification.recipientAuthId, AUTH_ID);
    assert.equal(notification.type, "account.suspended");
    assert.deepEqual(res.body.data, { authId: AUTH_ID, accountStatus: "SUSPENDED", suspendedUntil });
  });

  it("rechaza suspender a un administrador", async (t) => {
    const { service, model, publishModerationNotification } = buildService(t, {
      ...user, role: "ADMIN"
    });
    await assert.rejects(service.moderate(request, mockRes()), { status: 403 });
    assert.equal(model.findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(publishModerationNotification.mock.callCount(), 0);
  });

  it("rechaza una suspensión con fecha pasada", async (t) => {
    const { service, model } = buildService(t);
    await assert.rejects(service.moderate({
      ...request, body: { suspendedUntil: new Date(0).toISOString() }
    }, mockRes()), { status: 400 });
    assert.equal(model.findByIdAndUpdate.mock.callCount(), 0);
  });
});
