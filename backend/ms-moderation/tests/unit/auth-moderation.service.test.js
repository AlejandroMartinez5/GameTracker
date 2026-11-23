const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { AUTH_ID, mockRes, loadWithMocks } = require("../helpers");

const targetPath = path.join(__dirname, "../../../ms-auth/src/services/moderation.service.js");

describe("ms-auth moderation.service", () => {
  it("ms-auth protege ADMIN y persiste suspensión con auditoría", async (t) => {
    const publishModerationNotification = t.mock.fn();
    const updates = [];
    let target = { _id: AUTH_ID, role: "USER" };
    const service = loadWithMocks(targetPath, {
      mongoose: { isObjectIdOrHexString: () => true },
      "../utils/user-events.util": { publishModerationNotification },
      "../models/user.model": {
        findById: async () => target,
        findByIdAndUpdate: async (authId, update) => {
          updates.push(update.$set);
          return { _id: authId, ...update.$set };
        }
      }
    });
    const req = {
      params: { authId: AUTH_ID, action: "suspend" },
      user: { sub: "admin" },
      body: { suspendedUntil: new Date(Date.now() + 86400000).toISOString(), reason: " spam " }
    };
    const res = mockRes();
    await service.moderate(req, res);
    assert.equal(updates[0].accountStatus, "SUSPENDED");
    assert.equal(updates[0].moderatedByAuthId, "admin");
    assert.equal(updates[0].moderationReason, "spam");
    target = { _id: AUTH_ID, role: "ADMIN" };
    await assert.rejects(() => service.moderate(req, res), { status: 403 });
    assert.equal(updates.length, 1);
    assert.equal(publishModerationNotification.mock.callCount(), 1);
    const [notification] = publishModerationNotification.mock.calls[0].arguments;
    assert.equal(notification.recipientAuthId, AUTH_ID);
    assert.equal(notification.actorAuthId, "admin");
    assert.equal(notification.type, "account.suspended");
    assert.equal(notification.metadata.reason, "spam");
  });

  it("ms-auth rechaza suspensión sin fecha futura válida", async (t) => {
    const publishModerationNotification = t.mock.fn();
    const service = loadWithMocks(targetPath, {
      mongoose: { isObjectIdOrHexString: () => true },
      "../utils/user-events.util": { publishModerationNotification },
      "../models/user.model": { findById: async () => ({ _id: AUTH_ID, role: "USER" }) }
    });
    const req = {
      params: { authId: AUTH_ID, action: "suspend" },
      user: { sub: "admin" },
      body: {}
    };

    await assert.rejects(() => service.moderate(req, mockRes()), { status: 400 });
    assert.equal(publishModerationNotification.mock.callCount(), 0);
  });
});
