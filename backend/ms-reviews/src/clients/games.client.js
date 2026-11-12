const getGamesBaseUrl = () => {
  return (process.env.GAMES_SERVICE_URL || "http://localhost:3009/api/games").replace(/\/$/, "");
};

const assertGameExists = async ({ igdbId, token }) => {
  let response;

  try {
    response = await fetch(`${getGamesBaseUrl()}/${encodeURIComponent(igdbId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(Number(process.env.SERVICE_TIMEOUT_MS || 10000))
    });
  } catch (error) {
    const unavailable = new Error("No se pudo verificar el videojuego en este momento");
    unavailable.status = 502;
    throw unavailable;
  }

  if (response.status === 404) {
    const notFound = new Error("Videojuego no encontrado");
    notFound.status = 404;
    throw notFound;
  }

  if (!response.ok) {
    const failed = new Error("No se pudo verificar el videojuego en este momento");
    failed.status = 502;
    throw failed;
  }
};

module.exports = {
  assertGameExists
};
