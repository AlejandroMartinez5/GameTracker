const { requestService } = require('./http.client');
const request = (options) => requestService({ baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3003/api/auth', ...options });
const suspendUser = ({ authId, suspendedUntil, reason, token }) => request({ path: `/admin/users/${encodeURIComponent(authId)}/suspend`, method: 'PATCH', token, body: { suspendedUntil, reason } });
const banUser = ({ authId, reason, token }) => request({ path: `/admin/users/${encodeURIComponent(authId)}/ban`, method: 'PATCH', token, body: { reason } });
const getCurrentUser = async (token) => { const data = await request({ path: '/me', token }); return data.user; };
module.exports = { suspendUser, banUser, getCurrentUser };