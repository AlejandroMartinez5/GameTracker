const repository = require("../repositories/notifications.repository");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination.util");

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const authId = (value, field = "authId") => {
  const normalized = value?.trim();
  if (!normalized) fail(`${field} es obligatorio`);
  return normalized;
};
const id = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail("notificationId debe ser un entero mayor a 0");
  return parsed;
};
const text = (value, field, max) => {
  const normalized = value?.trim();
  if (!normalized) fail(`${field} es obligatorio`);
  if (normalized.length > max) fail(`${field} no puede exceder ${max} caracteres`);
  return normalized;
};

const metadata = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) fail("metadata debe ser un objeto JSON");
  return value;
};

const createNotification = async (data = {}) => repository.create({
  recipientAuthId: authId(data.recipientAuthId, "recipientAuthId"),
  actorAuthId: data.actorAuthId ? authId(data.actorAuthId, "actorAuthId") : null,
  type: text(data.type, "type", 80),
  title: text(data.title, "title", 140),
  body: text(data.body, "body", 1000),
  metadata: metadata(data.metadata)
});

const normalizeFilters = (query = {}) => {
  const status = query.status || "all";
  if (!["all", "read", "unread"].includes(status)) fail("status debe ser all, read o unread");
  return { status, type: query.type?.trim() || null };
};

const getNotifications = async (userId, query = {}) => {
  const user = authId(userId);
  const filters = normalizeFilters(query);
  const pagination = getPaginationParams(query);
  const total = await repository.countByRecipient(user, filters);
  const data = await repository.findByRecipient(user, filters, pagination);
  return { data, pagination: buildPaginationMeta({ ...pagination, total }) };
};

const getUnreadCount = async (userId) => ({ unreadCount: await repository.countUnread(authId(userId)) });

const markAsRead = async (userId, notificationId) => {
  const notification = await repository.markAsRead(id(notificationId), authId(userId));
  if (!notification) fail("Notificación no encontrada", 404);
  return notification;
};

const markAllAsRead = async (userId) => {
  const notifications = await repository.markAllAsRead(authId(userId));
  return { updated: notifications.length, notifications };
};

const deleteNotification = async (userId, notificationId) => {
  const notification = await repository.remove(id(notificationId), authId(userId));
  if (!notification) fail("Notificación no encontrada", 404);
  return notification;
};

const createEventNotification = async (payload) => {
  if (!payload?.recipientAuthId) return null;
  return createNotification(payload);
};

module.exports = { createNotification, createEventNotification, getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification };

