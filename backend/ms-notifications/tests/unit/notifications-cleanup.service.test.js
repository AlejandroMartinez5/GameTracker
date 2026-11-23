const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadWithMocks } = require("../helpers.cjs");

function buildJob(t, remove = async () => {}) {
  const deleteOlderThanDays = t.mock.fn(remove);
  const unref = t.mock.fn();
  const schedule = t.mock.method(globalThis, "setInterval", () => ({ unref }));
  const { startNotificationsCleanupJob } = loadWithMocks(
    path.join(__dirname, "../../src/services/notifications-cleanup.service.js"),
    { "../repositories/notifications.repository": { deleteOlderThanDays } }
  );
  return { startNotificationsCleanupJob, deleteOlderThanDays, schedule, unref };
}

function setCleanupEnv(t, days, hours) {
  for (const [key, value] of [
    ["NOTIFICATIONS_RETENTION_DAYS", days],
    ["NOTIFICATIONS_CLEANUP_INTERVAL_HOURS", hours]
  ]) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

describe("startNotificationsCleanupJob", () => {
  it("limpia al iniciar y vuelve a limpiar en el intervalo configurado", async (t) => {
    setCleanupEnv(t, "7.5", "2");
    const { startNotificationsCleanupJob, deleteOlderThanDays, schedule, unref } = buildJob(t);
    startNotificationsCleanupJob();

    const [cleanup, interval] = schedule.mock.calls[0].arguments;
    assert.equal(interval, 2 * 60 * 60 * 1000);
    assert.equal(unref.mock.callCount(), 1);
    assert.deepEqual(deleteOlderThanDays.mock.calls[0].arguments, [7]);
    await cleanup();
    assert.deepEqual(deleteOlderThanDays.mock.calls[1].arguments, [7]);
  });

  it("registra el error y permite ejecutar la limpieza en el siguiente intervalo", async (t) => {
    setCleanupEnv(t, "0", "0");
    const log = t.mock.method(console, "error", () => {});
    const { startNotificationsCleanupJob, deleteOlderThanDays, schedule } = buildJob(t, async () => {
      throw new Error("Base de datos no disponible");
    });
    startNotificationsCleanupJob();

    const [cleanup, interval] = schedule.mock.calls[0].arguments;
    await cleanup();

    assert.equal(interval, 60 * 60 * 1000);
    assert.deepEqual(deleteOlderThanDays.mock.calls[0].arguments, [1]);
    assert.equal(deleteOlderThanDays.mock.callCount(), 2);
    assert.equal(log.mock.callCount(), 2);
    assert.equal(log.mock.calls[0].arguments[1], "Base de datos no disponible");
  });
});
