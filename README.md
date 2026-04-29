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
- `.env.test`
- `.env.test.throttle`

For local production-like runs you can also create `.env.production`, but it is not required for MVP development and tests.

The application validates required environment variables on startup through `@nestjs/config` and Joi.

`DOTENV_CONFIG_PATH` selects which env file Nest loads.

For throttling-specific E2E tests, `.env.test.throttle` must currently use:

```env
THROTTLE_DEFAULT_LIMIT=2
THROTTLE_DEFAULT_TTL_MS=1000
```

These values are required because `test/throttling.e2e-spec.ts` currently asserts behavior against them.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

The current `docker-compose.yml` starts PostgreSQL 17 on port `5432` by default.

### 4. Run migrations

Before running the app or tests on a clean database, apply migrations:

```bash
pnpm migration:run:dev
pnpm migration:run:test
```

### 5. Start the app

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

Run all integration and E2E tests:

```bash
pnpm test
```

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
