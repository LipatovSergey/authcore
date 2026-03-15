# AuthCore

AuthCore is a NestJS authentication service built around JWT access and refresh tokens. Database is PostgreSQL.

Current MVP features:

- User registration
- Login with email and password
- Access token refresh with refresh token rotation
- Logout from current session
- Logout from all sessions
- Protected `GET /auth/me`
- Swagger UI documentation
- E2E coverage for auth flows and throttling

## Stack

- Node.js 20+
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- Argon2id
- JWT
- Jest + Supertest

## Architecture

The project follows a modular layered structure:

- `auth` handles controllers, DTOs, guards, token flow, and refresh token persistence
- `users` handles user persistence and lookup
- `database/migrations` stores database schema changes
- `config` centralizes environment-based configuration

Conventions used in the project:

- Service and internal code: `camelCase`
- API JSON: `snake_case`
- Database columns: `snake_case`

## API Overview

Available auth endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`

Swagger UI is available at `GET /api`.

## Authentication Model

- Access token: JWT sent in `Authorization: Bearer <token>`
- Refresh token: JWT sent in request body
- Refresh tokens are persisted in PostgreSQL
- Refresh flow uses token rotation
- Rotation is hardened with an atomic database transaction

## Prerequisites

- Node.js 20+
- pnpm (recommended)
- Docker and Docker Compose

## Set up

```bash
pnpm install
```

Create env files:
- `.env.development`
- `.env.test`
- `.env.test.throttle`

For local production-like runs you can also create `.env.production`, but it is not required for MVP development and tests.

The application validates required environment variables on startup through `@nestjs/config` and Joi.

Current required variables:

```env
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=

ARGON2_MEMORY_COST=
ARGON2_TIME_COST=
ARGON2_PARALLELISM=

THROTTLE_DEFAULT_LIMIT=
THROTTLE_DEFAULT_TTL_MS=

PORT=
NODE_ENV=
```


`DOTENV_CONFIG_PATH` selects which env file Nest loads.

For throttling-specific E2E tests, `.env.test.throttle` must currently use:

```env
THROTTLE_DEFAULT_LIMIT=2
THROTTLE_DEFAULT_TTL_MS=1000
```

These values are required because `test/throttling.e2e-spec.ts` currently asserts behavior against them.

## Running PostgreSQL

Start the local database with Docker Compose:

```bash
docker compose up -d
```

The current `docker-compose.yml` starts PostgreSQL 17 on port `5432` by default.

Before running the app or tests on a clean database, apply migrations:

```bash
pnpm migration:run:dev
pnpm migration:run:test
```

## Database Migrations

Development:

```bash
pnpm migration:run:dev
```

Test:

```bash
pnpm migration:run:test
```

Other available commands:

- `pnpm migration:show:dev`
- `pnpm migration:revert:dev`
- `pnpm migration:show:test`
- `pnpm migration:revert:test`

## Running The App

Development:

```bash
pnpm start:dev
```

Production build:

```bash
pnpm build
pnpm start:prod
```

## Testing

Run the main auth E2E suite:

```bash
pnpm test:e2e
```

Run throttling-specific E2E tests:

```bash
pnpm test:e2e:throttle
```

General test commands:

- `pnpm test`
- `pnpm test:watch`
- `pnpm test:cov`

## Swagger

Swagger UI is available at:

```text
http://localhost:3000/api
```

What is documented:

- Request DTO schemas and example values
- Success response schemas
- Standard auth and validation error response schemas
- Bearer authentication for protected endpoints

Typical manual flow in Swagger:

1. Call `POST /auth/register` or `POST /auth/login`
2. Copy the returned `access_token`
3. Click `Authorize`
4. Paste the token
5. Call `GET /auth/me`

## Rate Limiting

The MVP uses `@nestjs/throttler` with a global guard.

Current behavior:

- Global default throttle comes from env
- Route-specific overrides are applied on `register`, `login`, and `refresh`
- Throttling tests use a dedicated env file: `.env.test.throttle`

## Notes

- `Try it out` in Swagger uses the real development database
- Re-registering the same email should return a conflict error
- Redis is intentionally not part of the MVP and is planned for `v2.0.0`

## Current MVP Status

Implemented:

- Core auth endpoints
- Refresh token rotation with DB transaction
- Protected profile endpoint
- Global and route-level throttling
- Swagger documentation
