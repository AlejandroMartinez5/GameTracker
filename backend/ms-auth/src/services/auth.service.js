const bcrypt = require("bcrypt");
const userRepository = require("../repositories/user.repository");
const { signToken } = require("../middlewares/auth.middleware");

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
    profileImage: user.profileImage,
    role: user.role,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus
  };
}

async function registerUser(data = {}) {
  validateRegistration(data);

  const { email, username, name, password, profileImage } = data;
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  try {
    const user = await userRepository.createUser({
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      name: name.trim(),
      passwordHash,
      profileImage
    });

    return { user: toUserResponse(user) };
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
    role: user.role
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

module.exports = {
  registerUser,
  login,
  getCurrentUser
};
