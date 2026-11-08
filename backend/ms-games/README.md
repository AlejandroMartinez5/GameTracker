# ms-games

Microservicio de videojuegos de GameTracker. Consulta IGDB y guarda cada juego normalizado en MongoDB como caché persistente.

## Configuración

Copia `.env.example` como `.env` y completa `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`. Las credenciales se usan exclusivamente en el backend para obtener el token OAuth de Twitch; nunca se exponen al cliente.

## Endpoints

Los endpoints de `/api/games` requieren `Authorization: Bearer <jwt>`:

- `GET /api/games/search?q=minecraft&limit=10`
- `GET /api/games/popular?limit=10`
- `GET /api/games/by-genre/Adventure?limit=10`
- `GET /api/games/:igdbId`

La propiedad `source` indica si la respuesta salió de `cache` o de `igdb`.
