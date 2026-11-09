async function requestService({ baseUrl, path, method = "GET", token, body }) {
  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.SERVICE_TIMEOUT_MS || 10000))
    });
  } catch {
    throw Object.assign(new Error("Servicio externo no disponible"), { status: 502 });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || data.error || "Error en servicio externo"), {
      status: response.status >= 500 ? 502 : response.status
    });
  }
  return data.data ?? data;
}
module.exports = { requestService };