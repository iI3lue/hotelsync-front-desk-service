# HotelSync — Front Desk Service

Microservicio de recepción de HotelSync: llegadas del día, asignación de habitación, check-in, check-out e incidencias de huéspedes.

- **Producción:** https://hotelsync-front-desk-service.onrender.com
- **Puerto local:** 3005
- **Base de datos:** `front_desk_db` (PostgreSQL 16)

## Responsabilidad

| Hace | No hace |
| --- | --- |
| Listar llegadas y asignar habitación | Crear ni confirmar reservas (las consulta a Booking) |
| Ejecutar check-in/check-out | Cobrar ni cerrar folios (emite eventos) |
| Registrar y actualizar incidencias | Gestionar limpieza (emite `checkout.completed`) |
| Exigir reserva `confirmed` y evitar doble check-in | Ser dueño del inventario |

## Tecnologías

Node.js ≥20 · TypeScript · Express · Prisma · PostgreSQL 16 · Zod · RabbitMQ (outbox + consumidor de reservas).

## Arquitectura interna

`Route → Controller → Service → Prisma`, con Zod y `AppError`. Las mutaciones exigen sesión y rol de recepción. El check-in valida contra Booking que la reserva esté `confirmed` (409 si no) y la unicidad de `booking_id` impide el doble check-in. Los eventos se escriben en `EventOutbox` dentro de la transacción.

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | — | Estado del servicio |
| GET | `/v1/arrivals` | JWT + RECEPTIONIST / MANAGER / SUPER_ADMIN | Llegadas por hotel y fecha |
| POST | `/v1/check-in` | JWT + staff de recepción | Check-in (exige reserva `confirmed`) |
| GET | `/v1/check-in/:bookingId` | JWT + staff de recepción | Asignación de la reserva |
| POST | `/v1/check-out` | JWT + staff de recepción | Check-out |
| GET | `/v1/incidents` | JWT + staff de recepción | Lista incidencias |
| POST | `/v1/incidents` | JWT + staff de recepción | Crea incidencia |
| PATCH | `/v1/incidents/:id` | JWT + staff de recepción | Cambia estado |

## Modelo de datos

Tablas: `RoomAssignment`, `Arrival`, `EventOutbox`, `GuestIncident`.

Migraciones en `prisma/migrations` (4). Seed opcional: si se define `SEED_BOOKING_ID`, crea una asignación demo para esa reserva; sin la variable no inserta nada.

## Comunicación

- **REST saliente:** Booking `GET /v1/bookings/:id` (header `x-front-desk-key`) para validar la reserva.
- **Consume:** `booking.confirmed` y `booking.cancelled` (cola durable `front-desk.arrivals`) para mantener llegadas.
- **Publica:** `checkout.completed` (lo consumen Housekeeping y Billing) y `booking.completed` (lo consume Loyalty).

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | Puerto HTTP (default 3005) |
| `DATABASE_URL` | Sí | PostgreSQL de `front_desk_db` |
| `DIRECT_URL` | No | Conexión directa prevista para migraciones |
| `AUTH_JWT_SECRET` | Sí | HS256 compartido |
| `BOOKING_SERVICE_URL` | Sí | Base de booking-service |
| `BOOKING_SERVICE_KEY` | Sí | Debe coincidir con `FRONT_DESK_SERVICE_KEY` de Booking |
| `RABBITMQ_URL` | No | Sin ella no se consumen/publican eventos |
| `SEED_BOOKING_ID` | No | Solo seed |

Copiar `.env.example` a `.env` y completar los valores.

## Ejecución local

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed
npm run dev                 # http://localhost:3005
```

## Despliegue

Render (Oregon, free): build `npm ci && npx prisma generate && npm run build`; start `npx prisma migrate deploy && npm start`; Neon `front_desk_db`. El plan free duerme a los 15 minutos.

## Pruebas y verificación

```bash
npm test
npm run lint
curl https://hotelsync-front-desk-service.onrender.com/health
```

## Respaldo de base de datos

```bash
pg_dump "$DATABASE_URL" -Fc -f front_desk_db.dump
pg_restore --clean --if-exists -d "$DATABASE_URL" front_desk_db.dump
```

## Estructura

```
src/{routes,controllers,services,validators,middleware,lib}
prisma/{schema.prisma,seed.ts,migrations}
tests/
```
