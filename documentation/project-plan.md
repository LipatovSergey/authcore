# AuthCore Project Plan

## Overview

**Project:** AuthCore authentication service  
**Developer:** Solo learning / portfolio project  
**Goal:** Build a reusable, portfolio-ready authentication service for JavaScript applications  
**License:** MIT

AuthCore is a backend-first authentication service. It is designed to provide core auth flows through an API and to be used by separate client applications. A small demo frontend is included for manual testing and portfolio presentation.

The project also serves as practice for production-like development habits: issues, feature branches, pull requests, CI, Docker, deployment, and release discipline.

## Product Goals

- Provide a reusable authentication backend for JavaScript projects.
- Keep auth flows explicit, testable, and easy to reason about.
- Use PostgreSQL-backed state for security-sensitive token lifecycle decisions.
- Keep the backend independent from user-facing HTML pages.
- Include a demo frontend only as a client example, not as the core product.
- Maintain a project structure that can grow without becoming hard to navigate.

## Stack

- Node.js 20+
- NestJS
- TypeScript
- PostgreSQL 17
- TypeORM migrations
- Argon2id password hashing
- JWT access, refresh, email verification, and password reset tokens
- Jest + Supertest
- React + Vite demo frontend
- Docker Compose
- GitHub Actions CI
- Swagger / OpenAPI

## Architecture

Main backend modules:

- `auth` handles auth endpoints, DTOs, guards, token flows, and cleanup jobs.
- `users` handles user persistence and lifecycle data.
- `notifications` handles demo notification delivery and in-memory outbox access.
- `database/migrations` stores schema changes.
- `config` centralizes environment-based configuration.

Auth module organization:

- `auth/tokens` contains token-related services.
- `auth/cleanup` contains scheduled cleanup jobs.
- `auth/hashing` contains hashing implementation.
- `auth/entities` contains auth token entities.
- `auth/dto`, `auth/types`, and `auth/interfaces` contain API and internal contracts.

Conventions:

- Service and internal code: `camelCase`
- API JSON: `snake_case`
- Database columns: `snake_case`
- Schema changes are made through migrations, not synchronization.

## API Scope

Auth endpoints:

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
```

Demo endpoints:

```text
GET    /demo/notifications-outbox
DELETE /demo/notifications-outbox
```

Swagger UI:

```text
GET /api
```

## Core Auth Model

Users:

- registration creates an unverified user immediately;
- login is blocked until email verification is completed;
- `unverified_expires_at` is the source of truth for abandoned unverified account cleanup;
- email verification clears `unverified_expires_at`;
- resend verification and forgot-password can extend the unverified user lifetime.

Tokens:

- access tokens are short-lived JWTs sent as `Authorization: Bearer <token>`;
- refresh tokens are persisted in PostgreSQL and use rotation;
- email verification and password reset use JWT as transport plus stateful database records;
- raw verification/reset/refresh tokens are never stored;
- token hashes are stored in PostgreSQL;
- email verification and password reset tokens support expiration, one-time use, and revocation.

Security behavior:

- resend verification and forgot-password return generic `{ message: 'ok' }` responses to reduce account enumeration risk;
- password reset is allowed for unverified users;
- password reset does not verify email automatically;
- cleanup jobs remove stale lifecycle data after configurable retention windows.

## Demo Frontend Strategy

The demo frontend should demonstrate the auth service from a client perspective:

- registration;
- login;
- profile access;
- logout;
- email verification result handling;
- resend verification;
- forgot password;
- reset password;
- demo notification outbox.

The frontend should remain small and focused. It should not become a full product UI or duplicate backend responsibilities.

## Testing Strategy

- E2E tests cover main HTTP auth flows.
- Integration tests cover service-level behavior for non-trivial flows.
- Tests run against a real PostgreSQL test database.
- Test helpers are used for reusable fixtures.
- Cleanup behavior should be tested at the service level before testing scheduler orchestration.

Main commands:

```bash
pnpm test
pnpm test:e2e
pnpm test:integration
```

Full project verification:

```bash
pnpm lint:check
pnpm test
pnpm build
pnpm --filter demo-frontend lint
pnpm --filter demo-frontend build
```

## Development Workflow

Target workflow:

- create an issue for meaningful features, fixes, and refactors;
- create a feature/fix/refactor branch from `main`;
- open a pull request into `main`;
- require CI to pass before merge;
- keep `main` stable and deployable;
- delete feature branches after merge.

CI should cover:

- backend lint;
- backend migrations/tests/build;
- frontend lint/build.

## Deployment Direction

Local development:

- use Docker Compose for local PostgreSQL;
- keep development and test databases easy to bootstrap;
- keep env examples current.

Production-style deployment:

- build backend and frontend through Docker;
- run migrations before starting production services;
- keep deployment script simple and repeatable;
- keep secrets outside the repository.

## Roadmap

### Phase 1 - Core Auth MVP

- User registration
- Login
- Access token protection
- Refresh token rotation
- Logout current session
- Logout all sessions
- Protected profile endpoint
- Swagger documentation
- Integration and E2E tests

### Phase 2 - Email And Password Flows

- Email verification
- Email verification resend
- Password reset request
- Password reset confirmation
- Demo notification outbox
- Client redirect flow for verification/reset results

### Phase 3 - Lifecycle Cleanup

- Cleanup abandoned unverified users
- Cleanup stale email verification tokens
- Cleanup stale password reset tokens
- Cleanup stale refresh tokens
- Configurable retention policies
- UTC-based cleanup schedules

### Phase 4 - Demo And Developer Experience

- Demo React frontend
- Local Docker development setup
- CI through GitHub Actions
- Protected pull request workflow
- README and env example polish
- Production-like Docker deployment

### Phase 5 - Production Security Hardening

- Refresh token reuse detection
- HTTP-only cookie refresh flow
- CSRF protection
- Distributed rate limiting with Redis
- Helmet and CORS hardening
- Structured logging and request IDs
- Session listing and session revocation endpoints

### Phase 6 - Advanced Features

- Roles and permissions
- RS256 JWT signing
- Public key endpoint
- Production email provider integration
- Google OAuth login
- More complete client integration examples

## Non-Goals

- Full social login provider set beyond Google OAuth
- Full user-facing HTML pages served directly by the backend
- API gateway inside this project
- Horizontal scaling
- Distributed caching, except future Redis-backed rate limiting
- Turning the demo frontend into a full product application

## Related Work

- Demo frontend client for manual testing and portfolio presentation
- Future services can integrate with AuthCore as an external auth provider

---

**Last updated:** 2026-06-12  
**Plan version:** 1.2
