const service = require('../services/auth.service');
const emailVerification = require('../services/email-verification.service');

const register = async (req, res) => res.status(201).json(await service.registerUser(req.body));

const login = async (req, res) => res.json(await service.login(req.body));

const me = async (req, res) => res.json({ user: await service.getCurrentUser(req.user.sub) });


const resendVerification = async (req, res) => {
  const user = await service.getCurrentUser(req.user.sub);
  res.json(await emailVerification.sendCode(user));
};

const verifyEmail = async (req, res) => {
  const user = await service.getCurrentUser(req.user.sub);
  res.json(await emailVerification.verifyCode(user, req.body));
};

module.exports = { register, login, me, resendVerification, verifyEmail };