# ms-gateway

Punto de entrada HTTP para los microservicios de GameTracker.

El gateway conserva las rutas públicas (`/api/...`) y reenvía cada petición al
microservicio correspondiente. No sustituye la autenticación: el encabezado
`Authorization` se conserva y cada microservicio vuelve a validar el JWT con la
clave pública compartida.

## Ejecución local

```bash
npm install
npm start
```

El gateway queda disponible en `http://localhost:8080`.

## Rutas

| Prefijo | Servicio |
| --- | --- |
| `/api/auth` | ms-auth |
| `/api/games` | ms-games |
| `/api/friends` | ms-friends |
| `/api/favorites` | ms-user-library |
| `/api/notifications` | ms-notifications |
| `/api/achievements` | ms-achievements |
| `/api/reviews`, `/api/comments`, `/api/leaderboards` | ms-reviews |
| `/api/moderation` | ms-moderation |

La ruta `/health` pertenece al gateway y no requiere ningún microservicio.
