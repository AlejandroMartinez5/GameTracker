const mongoose = require('mongoose');
const User = require('../models/user.model');
const error = (message, status) => Object.assign(new Error(message), { status });

async function findUser(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw error('ID de usuario inválido', 400);
  const user = await User.findById(id);
  if (!user) throw error('Usuario no encontrado', 404);
  return user;
}
async function requireActiveUser(req, _res, next) {
  const user = await findUser(req.user.sub);
  if (user.accountStatus === 'BANNED' || (user.accountStatus === 'SUSPENDED' && (!user.suspendedUntil || user.suspendedUntil > new Date()))) {
    throw error('Cuenta no disponible', 403);
  }
  req.currentUser = user;
  next();
}
function requireAdmin(req, _res, next) {
  if (req.currentUser.role !== 'ADMIN') throw error('Se requiere rol de administrador', 403);
  next();
}
function publicProfile(user) {
  return { authId: String(user._id), name: user.name, username: user.username, profileImage: user.profileImage, createdAt: user.createdAt };
}
async function getPublicProfile(req, res) {
  res.json({ data: publicProfile(await findUser(req.params.authId)) });
}
async function moderate(req, res) {
  const user = await findUser(req.params.authId);
  if (user.role === 'ADMIN' || String(user._id) === req.user.sub) throw error('No puedes moderar una cuenta de administrador', 403);
  const reason = req.body?.reason;
  if (reason != null && (typeof reason !== 'string' || reason.length > 2000)) throw error('reason debe ser texto de hasta 2000 caracteres', 400);
  const suspendedUntil = req.params.action === 'suspend' ? new Date(req.body?.suspendedUntil) : null;
  if (suspendedUntil && (!Number.isFinite(suspendedUntil.getTime()) || suspendedUntil <= new Date())) throw error('suspendedUntil debe ser una fecha futura válida', 400);
  const updated = await User.findByIdAndUpdate(user._id, { $set: {
    accountStatus: suspendedUntil ? 'SUSPENDED' : 'BANNED', suspendedUntil,
    moderationReason: reason?.trim() || null, moderatedAt: new Date(), moderatedByAuthId: req.user.sub
  } }, { new: true, runValidators: true });
  res.json({ data: { authId: String(updated._id), accountStatus: updated.accountStatus, suspendedUntil: updated.suspendedUntil } });
}
async function removeProfilePhoto(req, res) {
  const user = await findUser(req.params.authId);
  if (user.role === 'ADMIN') throw error('No puedes moderar una cuenta de administrador', 403);
  await User.updateOne({ _id: user._id }, { $set: { profileImage: null } });
  res.json({ data: { authId: String(user._id), profileImage: null } });
}
module.exports = { requireActiveUser, requireAdmin, getPublicProfile, moderate, removeProfilePhoto };