const { verifyToken } = require('../utils/jwt.util');
const { getCurrentUser } = require('../clients/auth.client');

async function authenticateToken(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ message: 'Token requerido' });
  let decoded;
  try {
    decoded = verifyToken(match[1]);
    if (!decoded || typeof decoded !== 'object' || !/^[a-f\d]{24}$/i.test(decoded.sub || '')) throw new Error('Invalid subject');
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
  try {
    // Consultar el estado actual evita aceptar JWT previos a un baneo o cambio de rol.
    const user = await getCurrentUser(match[1]);
    if (!user || String(user._id) !== decoded.sub) return res.status(401).json({ message: 'Cuenta inválida' });
    if (['BANNED', 'SUSPENDED'].includes(user.accountStatus)) return res.status(403).json({ message: 'Cuenta no disponible' });
    req.authToken = match[1];
    req.user = { ...user, authId: decoded.sub };
    return next();
  } catch (error) {
    return res.status(error.status || 502).json({ message: error.message });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Se requiere rol de administrador' });
  return next();
}
module.exports = { authenticateToken, requireAdmin };