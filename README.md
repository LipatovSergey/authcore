# AuthCore

AuthCore is a NestJS authentication service built around JWT access and refresh tokens. Database is PostgreSQL.

Current MVP features:

- User registration
- Login with email and password
- Access token refresh with refresh token rotation
- Logout from current session
- Logout from all sessions
- Protected `GET /auth/me`
- Email verification with client redirect flow
- Verification resend flow
- Password reset flow
- Demo notifications outbox for local/manual auth flows
- Swagger UI documentation
- E2E and integration coverage for auth flows and throttling

## Stack

- Node.js 20+
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- Argon2id
- JWT
- Jest + Supertest
- Docker Compose
- GitHub Actions

## Architecture

The project follows a modular layered structure:

- `auth` handles controllers, DTOs, guards, token flow, and refresh token persistence
- `users` handles user persistence and lookup
- `notifications` handles demo notification delivery and outbox access
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
- `GET /auth/email-verification`
- `POST /auth/email-verification/resend`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

Demo endpoints:

- `GET /demo/notifications-outbox`
- `DELETE /demo/notifications-outbox`

Swagger UI is available at `GET /api`.

## Authentication Model

- Access token: JWT sent in `Authorization: Bearer <token>`
- Refresh token: JWT sent in request body
- Refresh tokens are persisted in PostgreSQL
- Refresh flow uses token rotation
- Rotation is hardened with an atomic database transaction

## Security Notes / Tradeoffs

- Email verification and password reset tokens use JWT as the transport format, but remain stateful through database records.
- Raw verification and reset tokens are never stored directly; only token hashes are persisted.
- Verification and reset flows keep only one active token per user by revoking the previous active token before creating a new one.
- `POST /auth/forgot-password` always returns `{ "message": "ok" }` to avoid leaking whether an email is registered.
- Password reset is allowed for unverified users, but it never verifies the email automatically.
- Login remains blocked until email verification is completed, even after a successful password reset.
- Unverified account cleanup is based on `unverifiedExpiresAt`, not on active token existence.

## Why Email Verification Also Uses JWT

Email verification in this project is intentionally implemented with **JWT + stateful database storage**, instead of using a completely separate random-token format.

This decision was made for several reasons.

First, the project already uses JWT as the main token mechanism for authentication flows. Reusing JWT for email verification keeps the overall design more consistent. Instead of maintaining one token model for access and refresh tokens and a second unrelated model for email verification, the service can rely on the same token transport format across the auth domain.

Second, JWT already provides several pieces of metadata that are useful for stateful verification flows:

- `jti` gives a unique token identifier that can be used for database lookup
- `sub` identifies the user the token belongs to
- `exp` provides a standard expiration claim that can be decoded into `expiresAt`

Using these standard claims removes the need to invent a custom token representation such as manually encoding an `id + secret` structure into a string. That makes the implementation easier to reason about and reduces custom token-format logic in the project.

Another important reason was token lookup. The database stores only a hash of the verification token, not the raw token itself. This project uses Argon2id for secure hashing, and Argon2 is intentionally non-deterministic because it uses a salt. That means hashing the same raw token again does not produce the same stored value. As a result, a random-token approach would require an additional lookup strategy, such as embedding an identifier into the token or storing a separate deterministic lookup hash.

Using JWT solves that problem more cleanly in this project. The verification token can carry a `jti`, which is used to find the correct database record, while the raw token is still verified against the stored hash. This preserves secure storage without forcing the project to introduce a second token format and a second lookup model.

Third, this project still keeps email verification **stateful**, even though the transport token is JWT. The database record is still required because the verification flow needs guarantees that a purely stateless token does not provide:

- one-time use
- explicit invalidation on resend
- revocation tracking
- database-backed lifecycle checks

In other words, JWT is used here as a convenient and standardized token container, not as a replacement for database state.

Fourth, this approach makes the internal architecture more uniform. The same high-level pattern can be used for both refresh tokens and email verification tokens:

1. issue a JWT
2. extract metadata such as `jti` and expiration
3. hash the raw token before storing it
4. persist the token record in PostgreSQL
5. validate both the JWT and the database state during verification

That consistency reduces cognitive overhead inside the project and makes the token flows easier to follow.

There was also a valid alternative: using a random one-time token instead of JWT. That approach is common in real systems and is a good model to know. However, for this project, it would have introduced an additional token format and a separate lookup strategy, which would make the codebase less cohesive. Since AuthCore is meant to be both a learning project and a portfolio-ready reusable auth service, consistency and clarity were prioritized here.

So the final tradeoff was:

- **JWT + stateful** for better consistency, reuse of standard claims, and simpler token lookup
- instead of **random token + stateful**, which is also valid but would introduce a second token model into the codebase

## Email Verification Lifecycle Notes

AuthCore creates the user record immediately during registration and keeps the account in an unverified state until the email link is confirmed.

Important behavior in the current design:

- login is blocked until email verification is completed
- resend verification invalidates the previous active verification token
- verification is handled by backend token processing followed by redirect to a configured client URL

Lifecycle policy for abandoned unverified accounts:

- cleanup will only consider users with `isEmailVerified = false`
- unverified users will store their cleanup deadline in `unverifiedExpiresAt`
- cleanup will be based on `unverifiedExpiresAt`, not on the active email verification token
- resend verification extends `unverifiedExpiresAt`
- password reset for unverified users also extends `unverifiedExpiresAt`
- email verification sets `unverifiedExpiresAt = null`
- initial cleanup TTL baseline: `7 days`

This keeps account cleanup tied to the user lifecycle instead of token lifecycle. Verification and reset tokens can be rotated or revoked independently without changing whether an unverified account is eligible for cleanup.

## Client Integration Notes

AuthCore is designed as an auth backend that is meant to be used together with a separate client application.

- email verification links point to the backend auth service first
- the backend resolves verification outcome and redirects to a configured client URL
- password reset is intended to follow the same client-driven model
- a small demo frontend is preferred over maintaining built-in backend HTML pages for user-facing auth flows

### Client Token Refresh Responsibility

Clients are responsible for calling `POST /auth/refresh` when an access token can no longer be used.

Expected client flow:

1. Send the access token to protected endpoints using `Authorization: Bearer <token>`.
2. If a protected request returns `401`, call `POST /auth/refresh` with the current refresh token.
3. If refresh succeeds, store the returned token pair and retry the original protected request.
4. If refresh returns `401`, clear stored tokens and require the user to sign in again.

## Demo Notifications Outbox

AuthCore does not send real emails in local/demo mode. Verification and password reset messages are stored in an in-memory notifications outbox so the full auth flow can be tested without SMTP or an external email provider.

Available when `ENABLE_DEMO_NOTIFICATIONS_OUTBOX=true`:

- `GET /demo/notifications-outbox` returns stored demo notification messages
- `DELETE /demo/notifications-outbox` clears the in-memory outbox

The outbox is intended for local development and portfolio demos only. Messages are lost when the application restarts. A real email provider can be added later behind the same notifications service contract.

## Prerequisites

- Node.js 20+
- pnpm (recommended)
- Docker and Docker Compose

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create env files

Create these env files using `.env.example` as a reference:

- `.env.development`
- `.env.test.throttle`

The committed `.env.test` file contains non-secret local/CI test values. It is used by automated tests and by the local test database setup.

For local production-like runs and Raspberry Pi deployment, create `.env.production`.

The application validates required environment variables on startup through `@nestjs/config` and Joi.

`DOTENV_CONFIG_PATH` selects which env file Nest loads.

For throttling-specific E2E tests, `.env.test.throttle` must currently use:

```env
THROTTLE_DEFAULT_LIMIT=2
THROTTLE_DEFAULT_TTL_MS=1000
```

These values are required because `test/throttling.e2e-spec.ts` currently asserts behavior against them.

### 3. Set up local databases

```bash
pnpm db:setup
```

This starts the local PostgreSQL container from `docker-compose.dev.yml`, creates both local databases on first container initialization, and runs development and test migrations.

Local database names:

- `authcore_development`
- `authcore_test`

The development compose file uses the container name `authcore` and stores data in the `postgres_dev_data` Docker volume.

Database initialization is handled by:

```text
docker/postgres/init-dev-test-db.sh
```

That script is mounted into the Postgres container at `/docker-entrypoint-initdb.d`. It runs only when the Postgres data volume is initialized for the first time. If the local database volume already exists and you need to recreate it from scratch, run:

```bash
docker compose --env-file .env.development -f docker-compose.dev.yml down -v
pnpm db:setup
```

### 4. Start the app

Development:

```bash
pnpm start:dev
```

Production build:

```bash
pnpm build
pnpm start:prod
```

### 5. Start the demo frontend

```bash
pnpm start:demo-frontend
```

## Testing

Run all integration and E2E tests:

```bash
pnpm test
```

Run the main auth E2E suite:

```bash
pnpm test:e2e
```

General test commands:

- `pnpm test`
- `pnpm test:watch`
- `pnpm test:cov`

Throttling-specific E2E coverage is part of the test suite. The project keeps `.env.test.throttle` as a dedicated reference env file for that scenario.

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

## Docker

The project has separate Docker Compose files for local development and production deployment.

### Local development

```bash
docker compose --env-file .env.development -f docker-compose.dev.yml up -d postgres
```

For normal onboarding, prefer:

```bash
pnpm db:setup
```

This command starts local Postgres, waits for the healthcheck, and runs both development and test migrations.

### Production

`docker-compose.prod.yml` is used for Raspberry Pi deployment. It runs:

- PostgreSQL
- backend API
- demo frontend served by Nginx

Production values are read from `.env.production`. Docker Compose needs the env file explicitly because compose variable interpolation happens before container environment loading:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Production migrations are run inside the API container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api pnpm migration:run:prod
```

## Deployment

Production deployment is automated by:

```text
scripts/deploy-prod.sh
```

The script:

1. fetches and fast-forwards `main`
2. builds Docker images
3. starts PostgreSQL
4. runs production migrations
5. starts all production services
6. prints current compose service status

Run it on the deployment host from the repository root:

```bash
./scripts/deploy-prod.sh
```

The script assumes that `.env.production` already exists on the host and contains real deployment values.

## CI

GitHub Actions CI runs on pull requests and pushes to `main`.

Backend CI:

- installs dependencies with pnpm
- runs backend lint
- starts PostgreSQL 17 for tests
- runs test migrations
- runs integration and E2E tests
- builds the NestJS app

Frontend CI:

- installs dependencies with pnpm
- runs demo frontend lint
- builds the Vite frontend

The workflow is defined in:

```text
.github/workflows/ci.yml
```

Recommended workflow:

1. create a feature branch
2. push the branch
3. open a pull request into `main`
4. wait for CI to pass
5. merge into `main`
6. deploy from the Raspberry Pi with `./scripts/deploy-prod.sh`

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
- Demo notifications outbox endpoints

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
- Email verification and resend
- Password reset
- Demo notifications outbox
- Protected profile endpoint
- Global and route-level throttling
- Swagger documentation
