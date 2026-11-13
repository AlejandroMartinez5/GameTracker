const service = require("../services/notifications.service");

const handle = (action) => async (req, res) => {
  try {
    const result = await action(req);
    return res.status(result?.status || 200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Error interno del servidor" });
  }
};

const createNotification = handle(async (req) => ({
  status: 201,
  message: "Notificación creada correctamente",
  data: await service.createNotification({ ...req.body, actorAuthId: req.body?.actorAuthId || req.user.authId })
}));
const getNotifications = handle(async (req) => ({ message: "Notificaciones obtenidas correctamente", ...(await service.getNotifications(req.user.authId, req.query)) }));
const getUnreadCount = handle(async (req) => service.getUnreadCount(req.user.authId));
const markAsRead = handle(async (req) => ({ message: "Notificación marcada como leída", data: await service.markAsRead(req.user.authId, req.params.notificationId) }));
const markAllAsRead = handle(async (req) => ({ message: "Notificaciones marcadas como leídas", ...(await service.markAllAsRead(req.user.authId)) }));
const deleteNotification = handle(async (req) => { await service.deleteNotification(req.user.authId, req.params.notificationId); return { message: "Notificación eliminada correctamente" }; });

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};

