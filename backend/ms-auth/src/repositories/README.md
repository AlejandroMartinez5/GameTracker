# ms-auth

Desde backend/ms-auth:

    npm start
    npm test

Configurar .env con MONGODB_URI y PORT (3003 por defecto). Las llaves RSA deben
estar en src/keys/private.pem y src/keys/public.pem; no se generan ni reemplazan
al arrancar. No subir las llaves ni .env al repositorio.

## Endpoints

- POST /api/auth/register: email, username, name, password y profileImage opcional.
  Devuelve 201 con user sin contraseña. Duplicados: 409; entradas inválidas: 400.
- POST /api/auth/login: email y password. Devuelve token RS256 de una hora y user.
  Credenciales incorrectas: 401; cuenta bloqueada: 403.
- GET /api/auth/me: Authorization: Bearer <token>. Consulta el usuario actual y
  comprueba que siga existiendo y no esté bloqueado.

Modelo único User en users. user.repository.js maneja persistencia;
auth.service.js valida entradas, usa bcrypt y genera JWT. Las escrituras son
sobre un documento; no requieren transacciones. El servidor conecta MongoDB e
inicializa índices antes de escuchar peticiones. Con índices desactivados en
producción, crearlos mediante el proceso de despliegue.

npm test ejecuta peticiones HTTP reales con almacenamiento simulado: comprueba
registro, hash, duplicados, login, firma RS256, acceso protegido y bloqueo.
No comprueba persistencia ni índices en una instancia real de MongoDB.

Recuperación de contraseña, correo de verificación, edición/eliminación por HTTP,
revocación de JWT y limitación de intentos no están implementados.

## Migración si ya hay datos de los dos modelos

Respaldar antes de migrar. Unir cada perfil users con auths mediante el antiguo
authId y copiar las credenciales y campos de cuenta, conservando los hashes.
Resolver cuentas sin perfil y conflictos de email/username. Retirar el índice
único authId_1 tras verificar la migración; impediría varios registros sin authId.
El identificador canónico ahora es users._id. Los JWT anteriores con sub basado
en auths._id requieren nuevo inicio de sesión o una migración explícita de IDs.
Este cambio de código no migra ni elimina documentos de MongoDB.

## Docker Compose (desarrollo local)

Desde la raíz del repositorio ejecutar `docker compose up --build -d`.
API: http://localhost:3003/api/auth. Salud: http://localhost:3003/health.
Ver estado con `docker compose ps` y logs con `docker compose logs -f ms-auth`.
Detener con `docker compose down`; conserva mongo_data. La opción down -v
elimina los datos, por lo que no debe usarse para detener normalmente.

Docker Desktop debe estar iniciado con contenedores Linux. El .env del servicio
usa MONGODB_URI=mongodb://mongo:27017/gametracker_auth. mongo es el nombre DNS
interno de Compose. Para ejecutar Node fuera de Docker se necesita otra URL
accesible desde el host; este Compose no publica el puerto de MongoDB.

Las llaves se montan en modo de solo lectura desde src/keys y se excluyen del
contexto de build. MongoDB usa un volumen persistente; no se publica al host.
La API solo se publica en 127.0.0.1:3003. Esta configuración es para desarrollo
local; MongoDB no tiene credenciales habilitadas.
