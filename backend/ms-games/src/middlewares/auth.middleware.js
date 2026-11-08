const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../../ms-auth/src/keys/public.pem');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

function authenticate(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ message: 'Token requerido' });
  try {
    const payload = jwt.verify(match[1], publicKey, { algorithms: ['RS256'] });
    if (!payload || typeof payload !== 'object' || !mongoose.isObjectIdOrHexString(payload.sub)) throw new Error('Invalid subject');
    req.user = payload;
    return next();
  } catch { return res.status(401).json({ message: 'Token inválido o expirado' }); }
}

module.exports = { authenticate };
