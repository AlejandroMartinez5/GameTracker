const { randomInt } = require("node:crypto");
const bcrypt = require("bcrypt");
const repository = require("../repositories/email-verification.repository");
const mailService = require("./mail.service");

function verificationError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function sendCode(user) {
  if (user.emailVerified) {
    return { emailVerified: true, message: "Tu correo ya está verificado" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = await bcrypt.hash(code, 10);
  const now = new Date();
  const account = await repository.issueCode(user._id, hash, now, new Date(now.getTime() + 600_000));

  if (!account) {
    throw verificationError("No se puede enviar otro código todavía. Espera 60 segundos", 429);
  }

  try {
    await mailService.sendVerificationCode(account.email, code);
  } catch {
    await repository.invalidateCode(user._id, hash);
    throw verificationError("No se pudo enviar el correo de verificación", 503);
  }

  return { emailVerified: false, message: "Código de verificación enviado", expiresIn: 600 };
}

async function verifyCode(user, data = {}) {
  if (!data || typeof data.code !== "string" || !/^\d{6}$/.test(data.code)) {
    throw verificationError("Introduce un código de seis dígitos", 400);
  }

  const account = await repository.reserveAttempt(user._id, new Date());
  if (!account || !(await bcrypt.compare(data.code, account.emailVerificationToken))) {
    throw verificationError("Código inválido, expirado o sin intentos disponibles", 400);
  }

  const verified = await repository.consumeCode(user._id, account.emailVerificationToken, new Date());
  if (!verified) {
    throw verificationError("El código ya fue utilizado o dejó de ser válido", 400);
  }

  return { emailVerified: true, message: "Correo verificado correctamente en GameTracker" };
}

module.exports = { sendCode, verifyCode };
