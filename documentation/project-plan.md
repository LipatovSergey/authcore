# AuthCore Project Plan

## General Info

**Project:** AuthCore authentication service  
**Developer:** Solo developer learning project  
**Goal:** Build a portfolio-ready auth service for reuse in other JavaScript projects  
**License:** MIT

## Current Stack

- Node.js 20+
- NestJS
- TypeScript with strict mode
- PostgreSQL 17
- TypeORM migrations
- Argon2id password hashing
- JWT access, refresh, verification, and reset tokens
- Jest + Supertest
- Docker Compose
- Swagger / OpenAPI

## Current Architecture

AuthCore uses a modular backend structure:

- `auth` handles auth HTTP endpoints, DTOs, guards, and auth orchestration
- `users` handles user persistence and lifecycle data
- `notifications` handles demo notification delivery and in-memory outbox access
- `database/migrations` stores schema changes
- `config` centralizes environment-based configuration

Conventions:

- Service and internal code: `camelCase`
- API JSON: `snake_case`
- Database columns: `snake_case`
- Schema changes are made through migrations, not synchronization

## Implemented Auth API

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
GET    /auth/me
GET    /auth/email-verification
POST   /auth/email-verification/resend
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /demo/notifications-outbox
DELETE /demo/notifications-outbox
```

## Core Data Models

**Users**

```typescript
{
  id: UUID
  email: string
  password_hash: string
  is_email_verified: boolean
  email_verified_at: timestamp | null
  unverified_expires_at: timestamp | null
  created_at: timestamp
  updated_at: timestamp
}
```

**Refresh Tokens**

```typescript
{
  id: UUID
  user_id: UUID
  jti: string
  token_hash: string
  expires_at: timestamp
  created_at: timestamp
  revoked_at: timestamp | null
}
```

**Email Verification Tokens / Password Reset Tokens**

```typescript
{
  id: UUID
  user_id: UUID
  jti: string
  token_hash: string
  expires_at: timestamp
  used_at: timestamp | null
  revoked_at: timestamp | null
  created_at: timestamp
}
```

## Key Auth Decisions

- Registration creates an unverified user immediately.
- Login is blocked until email verification is completed.
- Email verification and password reset use JWT as transport plus stateful database storage.
- Raw verification/reset tokens are never stored; only hashes are persisted.
- Verification/reset token state supports expiration, one-time use, and revocation.
- Resend verification and forgot-password return generic `{ message: 'ok' }` responses to reduce account enumeration risk.
- Password reset is allowed for unverified users.
- Password reset does not verify email automatically.
- `unverified_expires_at` is the user lifecycle source of truth for cleanup.
- Resend verification and forgot-password extend `unverified_expires_at` for unverified users.
- Email verification clears `unverified_expires_at`.
- Abandoned unverified users are cleaned up by scheduled policy based on user fields.

## Client And Demo Strategy

AuthCore is backend-first and expects a separate client application for user-facing screens.

- Email verification is resolved by the backend and redirected to a configured client result URL.
- Password reset links point to a configured client reset page.
- The backend does not serve built-in HTML auth pages.
- Local/demo mode uses an in-memory notifications outbox instead of real email delivery.
- Demo notification outbox is enabled by `ENABLE_DEMO_NOTIFICATIONS_OUTBOX=true`.

## Testing Strategy

- E2E tests cover main HTTP auth flows.
- Integration tests cover service-level behavior for non-trivial flows.
- Test suites run sequentially against a real PostgreSQL test database.
- Throttling tests use a dedicated environment file.

Main commands:

```bash
pnpm test
pnpm test:e2e
pnpm test:integration
pnpm test:e2e:throttle
```

## v1.1.0 Status

Goal: complete email verification, password reset, unverified user cleanup, and demo-friendly notification handling.

Implemented:

- Email verification flow
- Email verification resend flow
- Password reset flow
- User-based cleanup policy for abandoned unverified accounts
- Demo notifications outbox
- E2E and integration tests for key auth flows
- Swagger documentation for auth and demo outbox endpoints

Remaining before tagging `v1.1.0`:

- Add a small demo frontend
- Final README and `.env.example` review
- Final build, lint, and test pass
- Optional package metadata polish

## Roadmap

### v2.0.0 - Production Security

- Multiple sessions
- Session listing and session revocation endpoints
- HTTP-only cookie refresh flow
- CSRF protection
- Distributed rate limiting with Redis
- Helmet and CORS hardening
- Structured logging and request IDs

### v2.1.0 - Advanced Features

- Roles and permissions
- RS256 JWT signing
- Public key endpoint
- Deployment setup
- CI/CD

## Non-Goals For Current Version

- OAuth and social login
- Full user-facing HTML pages served directly by the auth backend
- API Gateway inside this project
- Horizontal scaling
- Distributed caching
- Production email provider integration

## Related Work

- Demo frontend client for manual testing and portfolio presentation
- `notes-service` as a separate service that can integrate with AuthCore

---

**Last updated:** 2026-04-28  
**Plan version:** 1.1
