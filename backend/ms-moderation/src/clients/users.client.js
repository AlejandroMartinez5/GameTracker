const { requestService } = require('./http.client');
const request = (options) => requestService({ baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3003/api/auth', ...options });
const getPublicProfile = ({ authId, token }) => request({ path: `/users/${encodeURIComponent(authId)}/profile`, token });
const removeProfilePhoto = ({ authId, token }) => request({ path: `/admin/users/${encodeURIComponent(authId)}/profile-photo`, method: 'DELETE', token });
module.exports = { getPublicProfile, removeProfilePhoto };