const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const privateKey = fs.readFileSync(path.join(__dirname, '../keys/private.pem'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, '../keys/public.pem'), 'utf8');
const signToken = payload => jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
const verifyToken = token => jwt.verify(token, publicKey, { algorithms: ['RS256'] });
const authenticate = (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ message: 'Token requerido' });
  try {
    const payload = verifyToken(match[1]);
    if (!payload || typeof payload !== 'object' || !mongoose.isObjectIdOrHexString(payload.sub)) throw new Error('Invalid subject');
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
module.exports = { signToken, verifyToken, authenticate };
