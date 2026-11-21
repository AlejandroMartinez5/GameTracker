const requestService = async ({ baseUrl, path, token, unwrapData = true }) => {
  let response;

  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(Number(process.env.SERVICE_TIMEOUT_MS || 10000))
    });
  } catch {
    throw new Error("Servicio externo no disponible");
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || "Error en servicio externo");
  }

  return unwrapData ? (body.data ?? body) : body;
};

module.exports = { requestService };
