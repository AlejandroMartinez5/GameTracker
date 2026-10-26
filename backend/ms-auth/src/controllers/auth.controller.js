const service = require('../services/auth.service');
const register = async (req, res) => res.status(201).json(await service.registerUser(req.body));
const login = async (req, res) => res.json(await service.login(req.body));
const me = async (req, res) => res.json({ user: await service.getCurrentUser(req.user.sub) });
module.exports = { register, login, me };
