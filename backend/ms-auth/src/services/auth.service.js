const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const userRepository = require("../repositories/user.repository");
const { signToken } = require("../middlewares/auth.middleware");
const emailVerification = require("./email-verification.service");
const mailService = require("./mail.service");
const profileClient = require("../clients/profile.client");
const statsClient = require("../clients/stats.client");

const PASSWORD_SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 30;
const BCRYPT_MAX_BYTES = 72;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 25;
const DUPLICATE_KEY_ERROR = 11000;

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validatePassword(password, fieldName = "La contraseña") {
  if (typeof password !== "string" ||
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH ||
      Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    throw createError(`${fieldName} debe tener entre 8 y 30 caracteres y no superar 72 bytes`, 400);
  }
}

function createNumericCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashResetCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function validateObjectId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw createError("ID de usuario inválido", 400);
  }
}

function validateUsername(username) {
  if (!isNonEmptyString(username)) {
    throw createError("El username es obligatorio", 400);
  }

  const normalized = username.trim().toLowerCase();

  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    throw createError("El username debe tener entre 3 y 25 caracteres", 400);
  }

  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    throw createError("El username solo puede contener letras, numeros, punto, guion o guion bajo", 400);
  }

  return normalized;
}

function validateRegistration(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw createError("Los datos de registro deben ser un objeto", 400);
  }

  const { email, username, name, password, profileImage } = data;

  if (![email, username, name].every(isNonEmptyString)) {
    throw createError("Email, username y nombre son obligatorios", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError("Email inválido", 400);
  }

  const usernameLength = username.trim().length;
  if (usernameLength < USERNAME_MIN_LENGTH || usernameLength > USERNAME_MAX_LENGTH) {
    throw createError("El username debe tener entre 3 y 25 caracteres", 400);
  }

  if (typeof password !== "string" ||
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH ||
      Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    throw createError("La contraseña debe tener entre 8 y 30 caracteres y no superar 72 bytes", 400);
  }

  if (profileImage !== undefined && profileImage !== null && typeof profileImage !== "string") {
    throw createError("Imagen de perfil inválida", 400);
  }
}

function validateLogin(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw createError("Credenciales inválidas", 401);
  }

  if (!isNonEmptyString(data.email) ||
      typeof data.password !== "string" ||
      Buffer.byteLength(data.password, "utf8") > BCRYPT_MAX_BYTES) {
    throw createError("Credenciales inválidas", 401);
  }
}

function assertAccountAvailable(user) {
  if (user.accountStatus === "BANNED") {
    throw createError("Cuenta no disponible", 403);
  }

  const isSuspended = user.accountStatus === "SUSPENDED";
  const suspensionIsActive = !user.suspendedUntil || user.suspendedUntil > new Date();

  if (isSuspended && suspensionIsActive) {
    throw createError("Cuenta no disponible", 403);
  }
}

function toUserResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    username: user.username,
    profileImage: user.profileImageMimeType
      ? `/api/auth/users/${user._id}/profile-image`
      : null,
    role: user.role,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus === "SUSPENDED" && user.suspendedUntil && user.suspendedUntil <= new Date() ? "ACTIVE" : user.accountStatus
  };
}

function toPublicProfile(user) {
  return {
    authId: String(user._id),
    name: user.name,
    username: user.username,
    profileImage: user.profileImageMimeType
      ? `/api/auth/users/${user._id}/profile-image`
      : null,
    createdAt: user.createdAt
  };
}

function toAdminUserResponse(user) {
  return {
    authId: String(user._id),
    name: user.name,
    email: user.email,
    username: user.username,
    profileImage: user.profileImageMimeType
      ? `/api/auth/users/${user._id}/profile-image`
      : null,
    role: user.role,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    suspendedUntil: user.suspendedUntil,
    moderationReason: user.moderationReason,
    moderatedAt: user.moderatedAt,
    moderatedByAuthId: user.moderatedByAuthId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function registerUser(data = {}) {
  validateRegistration(data);

  const {
    email,
    username,
    name,
    password,
    profileImageData
  } = data;
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  try {
    const user = await userRepository.createUser({
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      name: name.trim(),
      passwordHash,
      profileImageData: profileImageData?.data,
      profileImageMimeType: profileImageData?.mimeType
    });

    // La cuenta permanece creada aunque Gmail no esté disponible.
    let verification;
    try {
      verification = await emailVerification.sendCode(user);
    } catch {
      verification = {
        emailVerified: false,
        message: "Cuenta creada. No se pudo enviar el código; inicia sesión y solicita el reenvío"
      };
    }

    return { user: toUserResponse(user), verification };
  } catch (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      throw createError("El email o username ya está registrado", 409);
    }

    throw error;
  }
}

async function login(data = {}) {
  validateLogin(data);

  const email = data.email.trim().toLowerCase();
  const user = await userRepository.findCredentialsByEmail(email);

  if (!user) {
    throw createError("Credenciales inválidas", 401);
  }

  const passwordMatches = await bcrypt.compare(data.password, user.password);
  if (!passwordMatches) {
    throw createError("Credenciales inválidas", 401);
  }

  assertAccountAvailable(user);

  const token = signToken({
    sub: String(user._id),
    authId: String(user._id),
    role: user.role,
    emailVerified: user.emailVerified
  });

  return { token, user: toUserResponse(user) };
}

async function getCurrentUser(id) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Cuenta no encontrada", 401);
  }

  assertAccountAvailable(user);
  return toUserResponse(user);
}

async function updateProfile(id, { name, username, image = null } = {}) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Cuenta no encontrada", 404);
  }

  const changes = {};

  if (name !== undefined) {
    if (!isNonEmptyString(name) || name.trim().length > 100) {
      throw createError("El nombre debe tener entre 1 y 100 caracteres", 400);
    }

    changes.name = name.trim();
  }

  if (username !== undefined) {
    changes.username = validateUsername(username);
  }

  if (image) {
    changes.profileImageData = image.data;
    changes.profileImageMimeType = image.mimeType;
  }

  if (Object.keys(changes).length === 0) {
    throw createError("No hay cambios para actualizar", 400);
  }

  try {
    return toUserResponse(await userRepository.updateUserById(id, changes));
  } catch (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      throw createError("El username ya esta registrado", 409);
    }

    throw error;
  }
}

async function updateUsername(id, username) {
  return updateProfile(id, { username });
}

async function removeProfileImage(id) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Cuenta no encontrada", 404);
  }

  await userRepository.updateUserById(id, {
    profileImageData: null,
    profileImageMimeType: null
  });

  return { authId: String(id), profileImage: null };
}

async function getProfileImage(id) {
  const user = await userRepository.findProfileImageById(id);

  if (!user || !user.profileImageData) {
    throw createError("El usuario no tiene imagen de perfil", 404);
  }

  return {
    data: user.profileImageData,
    mimeType: user.profileImageMimeType,
  };
}

async function forgotPassword(email) {
  if (!isNonEmptyString(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError("Introduce un email válido", 400);
  }

  const user = await userRepository.findByEmail(email);

  if (!user) {
    return { passwordResetEmailSent: false };
  }

  const code = createNumericCode();
  const tokenHash = hashResetCode(code);
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await userRepository.setPasswordResetToken(user._id, tokenHash, expires);

  try {
    await mailService.sendPasswordResetCode(user.email, code);
  } catch (error) {
    await userRepository.clearPasswordResetToken(user._id);
    throw createError("No se pudo enviar el correo de recuperación", 503);
  }

  return { passwordResetEmailSent: true, expiresIn: 900 };
}

async function resetPassword({ code, token, password } = {}) {
  const resetCode = code || token;

  if (typeof resetCode !== "string" || !/^\d{6}$/.test(resetCode)) {
    throw createError("Introduce un código de recuperación de seis dígitos", 400);
  }

  validatePassword(password, "La nueva contraseña");

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  const updatedUser = await userRepository.consumePasswordResetToken(
    hashResetCode(resetCode),
    passwordHash
  );

  if (!updatedUser) {
    throw createError("Código de recuperación inválido o expirado", 400);
  }

  return { message: "Contraseña restablecida correctamente" };
}

async function changePassword(id, { currentPassword, newPassword } = {}) {
  validateObjectId(id);

  if (typeof currentPassword !== "string") {
    throw createError("La contraseña actual es obligatoria", 400);
  }

  validatePassword(newPassword, "La nueva contraseña");

  const user = await userRepository.findCredentialsById(id);

  if (!user) {
    throw createError("Cuenta no encontrada", 404);
  }

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw createError("La contraseña actual es incorrecta", 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  const updatedUser = await userRepository.updatePassword(id, user.password, passwordHash);

  if (!updatedUser) {
    throw createError("No se pudo actualizar la contraseña", 409);
  }

  return { message: "Contraseña cambiada correctamente" };
}

async function unbanUser(id, adminId) {
  validateObjectId(id);

  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Usuario no encontrado", 404);
  }

  if (user.role === "ADMIN" || String(user._id) === String(adminId)) {
    throw createError("No puedes modificar la cuenta de un administrador", 403);
  }

  const updatedUser = await userRepository.updateAccountStatus(id, {
    accountStatus: "ACTIVE",
    suspendedUntil: null,
    moderationReason: null,
    moderatedAt: new Date(),
    moderatedByAuthId: adminId
  });

  return toAdminUserResponse(updatedUser);
}

async function getAdminStats() {
  return userRepository.getAdminStats();
}

async function searchUsers(query, { admin = false, limit = 20 } = {}) {
  if (!isNonEmptyString(query)) {
    throw createError("El término de búsqueda es obligatorio", 400);
  }

  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    throw createError("El parámetro limit debe ser un entero entre 1 y 50", 400);
  }

  const users = await userRepository.searchUsers(query.trim(), parsedLimit);
  return users.map(admin ? toAdminUserResponse : toPublicProfile);
}

async function getPublicProfileByUsername(username, token) {
  if (!isNonEmptyString(username)) {
    throw createError("El username es obligatorio", 400);
  }

  const user = await userRepository.findByUsername(username);

  if (!user) {
    throw createError("Usuario no encontrado", 404);
  }

  return getPublicProfile(user._id, token);
}

async function getPublicProfile(id, token) {
  validateObjectId(id);

  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Usuario no encontrado", 404);
  }

  const related = await profileClient.getProfileDetails({
    authId: String(user._id),
    token
  });

  return {
    ...toPublicProfile(user),
    reviews: related.reviews,
    reviewsPagination: related.reviewsPagination,
    reviewsSummary: related.reviewsSummary,
    library: related.library,
    libraryPagination: related.libraryPagination,
    friends: related.friends,
    friendsPagination: related.friendsPagination,
    friendsSummary: related.friendsSummary,
    unavailableServices: related.unavailableServices
  };
}

async function getAdminUser(id) {
  validateObjectId(id);

  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Usuario no encontrado", 404);
  }

  return toAdminUserResponse(user);
}

async function getAccountStatus(id) {
  validateObjectId(id);

  const user = await userRepository.findById(id);

  if (!user) {
    throw createError("Usuario no encontrado", 404);
  }

  return {
    authId: String(user._id),
    accountStatus: user.accountStatus,
    suspendedUntil: user.suspendedUntil,
    moderationReason: user.moderationReason,
    moderatedAt: user.moderatedAt,
    moderatedByAuthId: user.moderatedByAuthId
  };
}

async function getGlobalAdminStats(token) {
  const users = await userRepository.getAdminStats();
  const serviceStats = await Promise.allSettled([
    statsClient.getModerationStats(token),
    statsClient.getReviewStats(token),
    statsClient.getFavoriteStats(token),
    statsClient.getFriendStats(token),
    statsClient.getGameStats(token)
  ]);
  const names = ["moderation", "reviews", "favorites", "friends", "games"];
  const stats = { users };
  const unavailableServices = [];

  serviceStats.forEach((result, index) => {
    const name = names[index];

    if (result.status === "fulfilled") {
      stats[name] = result.value;
    } else {
      stats[name] = null;
      unavailableServices.push(name);
    }
  });

  if (unavailableServices.length) {
    stats.unavailableServices = unavailableServices;
  }

  return stats;
}

module.exports = {
  registerUser,
  login,
  getCurrentUser,
  updateProfile,
  updateUsername,
  removeProfileImage,
  getProfileImage,
  forgotPassword,
  resetPassword,
  changePassword,
  unbanUser,
  getAdminStats: getGlobalAdminStats,
  searchUsers,
  getPublicProfileByUsername,
  getPublicProfile,
  getAdminUser,
  getAccountStatus
};
