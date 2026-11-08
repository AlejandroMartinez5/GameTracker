const axios = require('axios');

const tokenClient = axios.create({ baseURL: process.env.IGDB_TOKEN_URL || 'https://id.twitch.tv/oauth2/token', timeout: 10000 });
const apiClient = axios.create({ baseURL: process.env.IGDB_API_URL || 'https://api.igdb.com/v4', timeout: 15000, headers: { Accept: 'application/json' } });

let accessToken;
let expiresAt = 0;
let pendingTokenRequest;

async function getAccessToken() {
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_CLIENT_SECRET) {
    throw Object.assign(new Error('Faltan IGDB_CLIENT_ID o IGDB_CLIENT_SECRET en .env'), { status: 500 });
  }
  const safetyWindow = Number(process.env.IGDB_TOKEN_SAFETY_SECONDS || 60) * 1000;
  if (accessToken && Date.now() < expiresAt - safetyWindow) return accessToken;
  if (pendingTokenRequest) return pendingTokenRequest;

  pendingTokenRequest = tokenClient.post('', null, {
    params: { client_id: process.env.IGDB_CLIENT_ID, client_secret: process.env.IGDB_CLIENT_SECRET, grant_type: 'client_credentials' }
  }).then(response => {
    accessToken = response.data.access_token;
    expiresAt = Date.now() + (response.data.expires_in * 1000);
    return accessToken;
  }).finally(() => { pendingTokenRequest = null; });

  return pendingTokenRequest;
}

async function queryGames(query) {
  const token = await getAccessToken();
  try {
    const response = await apiClient.post('/games', query, {
      headers: { 'Client-ID': process.env.IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) { accessToken = undefined; expiresAt = 0; }
    const mappedError = new Error(error.response?.data?.message || 'Error al consultar IGDB');
    mappedError.status = error.response?.status >= 400 && error.response.status < 500 ? error.response.status : 502;
    throw mappedError;
  }
}

module.exports = { queryGames };
