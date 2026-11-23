const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadWithMocks } = require("../helpers.cjs");

function buildRepository(t, rows = []) {
  const query = t.mock.fn(async () => ({ rows }));
  const repository = loadWithMocks(path.join(__dirname, "../../src/repositories/notifications.repository.js"), {
    "../config/db": { pool: { query } }
  });
  return { repository, query };
}

describe("notifications.repository", () => {
  it("omite eventos duplicados y conserva el contenido como parámetros SQL", async (t) => {
    const { repository, query } = buildRepository(t);
    const metadata = { reportId: 42 };
    const result = await repository.create({
      recipientAuthId: "user-1", type: "report.created", title: "Reporte",
      body: "Pendiente", metadata, eventId: "evt-1"
    });

    assert.equal(result, null);
    const [sql, params] = query.mock.calls[0].arguments;
    assert.match(sql, /ON CONFLICT \(event_id\) WHERE event_id IS NOT NULL DO NOTHING/);
    assert.deepEqual(params, ["user-1", null, "report.created", "Reporte", "Pendiente",
      JSON.stringify(metadata), "evt-1"]);
  });

  it("filtra por destinatario y estado con orden y paginación", async (t) => {
    const rows = [{ id: 42 }];
    const { repository, query } = buildRepository(t, rows);

    assert.equal(await repository.findByRecipient("user-1", {
      status: "unread", type: "report.created"
    }, { limit: 10, offset: 20 }), rows);

    const [sql, params] = query.mock.calls[0].arguments;
    assert.match(sql, /recipient_auth_id = \$1 AND read_at IS NULL AND type = \$2/);
    assert.match(sql, /ORDER BY created_at DESC LIMIT \$3 OFFSET \$4/);
    assert.deepEqual(params, ["user-1", "report.created", 10, 20]);
  });

  it("limita el marcado y la eliminación al destinatario", async (t) => {
    const { repository, query } = buildRepository(t);

    assert.equal(await repository.markAsRead(42, "user-1"), null);
    assert.equal(await repository.remove(42, "user-1"), null);

    for (const { arguments: [sql, params] } of query.mock.calls) {
      assert.match(sql, /WHERE id = \$1 AND recipient_auth_id = \$2/);
      assert.deepEqual(params, [42, "user-1"]);
    }
    assert.match(query.mock.calls[0].arguments[0], /COALESCE\(read_at, CURRENT_TIMESTAMP\)/);
  });
});
