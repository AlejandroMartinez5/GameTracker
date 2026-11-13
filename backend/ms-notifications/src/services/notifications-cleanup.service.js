const repository = require("../repositories/notifications.repository");

const startNotificationsCleanupJob = () => {
  const days = Math.max(Number(process.env.NOTIFICATIONS_RETENTION_DAYS || 30), 1);
  const hours = Math.max(Number(process.env.NOTIFICATIONS_CLEANUP_INTERVAL_HOURS || 24), 1);
  const cleanup = () => repository.deleteOlderThanDays(Math.floor(days)).catch((error) => console.error("[ms-notifications] Error limpiando notificaciones:", error.message));
  cleanup();
  const interval = setInterval(cleanup, hours * 60 * 60 * 1000);
  interval.unref?.();
};

module.exports = { startNotificationsCleanupJob };

